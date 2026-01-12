/**
 * AI Assistant Streaming Handler
 * Handles AI chat requests with Server-Sent Events (SSE) streaming
 * Like ChatGPT - text appears word by word
 */

import type { Employee } from '../../_shared/auth.ts';
import { AI_TOOLS_OPENAI, type ToolName } from '../services/toolDefinitions.ts';
import { executeTool } from '../services/toolExecutor.ts';
import {
  compressContext,
  createEntityMemory,
  serializeMemory,
  buildEntityContext,
  updateMemoryFromToolCall,
  type EntityMemory,
  type ConversationSummary,
} from '../services/contextManager.ts';
import {
  getOrCreateSession,
  updateSession,
  sessionToEntityMemory,
  saveMessages,
  type AISession,
} from '../services/sessionService.ts';
import { createServiceClient } from '../../_shared/supabase.ts';

/**
 * Clean and extract UUID prefix from a string
 * Strips brackets, dots, ellipsis, and other non-hex characters
 * Returns the cleaned prefix suitable for ilike query (keeps hyphens)
 */
function extractUUIDPrefix(value: string): string | null {
  // Remove common formatting: brackets, dots, ellipsis, quotes, spaces
  const cleaned = value.replace(/[\[\]"'.\s]/g, '').replace(/\.{2,}/g, '');
  // Extract only valid UUID characters (hex + hyphens)
  const uuidMatch = cleaned.match(/^[0-9a-fA-F-]+/);
  if (!uuidMatch) return null;
  // Remove trailing hyphens but keep internal ones
  const uuidPart = uuidMatch[0].replace(/-+$/, '');
  // Count only hex characters (not hyphens) for minimum length check
  const hexOnly = uuidPart.replace(/-/g, '');
  // Need at least 4 hex chars for a meaningful prefix match
  return hexOnly.length >= 4 ? uuidPart : null;
}

/**
 * Resolve partial UUIDs to full UUIDs
 * Used to fix IDs from entity memory context that are shortened for token efficiency
 * Handles various formats: "a1b2c3d4", "[a1b2c3d4]", "a1b2c3d4...", etc.
 */
async function resolvePartialUUIDs(
  toolArgs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const resolved = { ...toolArgs };

  // Resolve site_id if it's shorter than full UUID (36 chars)
  if (typeof resolved.site_id === 'string' && resolved.site_id.length < 36) {
    const prefix = extractUUIDPrefix(resolved.site_id);
    if (prefix) {
      const { data: site } = await supabase
        .from('main_sites')
        .select('id')
        .ilike('id', `${prefix}%`)
        .limit(1)
        .single();
      if (site) {
        console.log(`[ai-stream] Resolved partial site_id "${resolved.site_id}" -> ${site.id}`);
        resolved.site_id = site.id;
      }
    }
  }

  // Resolve employee_ids if they are partial UUIDs
  if (Array.isArray(resolved.employee_ids)) {
    const resolvedIds: string[] = [];
    for (const empId of resolved.employee_ids) {
      if (typeof empId === 'string' && empId.length < 36) {
        const prefix = extractUUIDPrefix(empId);
        if (prefix) {
          const { data: emp } = await supabase
            .from('main_employees')
            .select('id')
            .ilike('id', `${prefix}%`)
            .limit(1)
            .single();
          if (emp) {
            console.log(`[ai-stream] Resolved partial employee_id "${empId}" -> ${emp.id}`);
            resolvedIds.push(emp.id);
          } else {
            resolvedIds.push(empId);
          }
        } else {
          resolvedIds.push(empId);
        }
      } else {
        resolvedIds.push(empId as string);
      }
    }
    resolved.employee_ids = resolvedIds;
  }

  // Resolve company_id if it's shorter than full UUID
  if (typeof resolved.company_id === 'string' && resolved.company_id.length < 36) {
    const prefix = extractUUIDPrefix(resolved.company_id);
    if (prefix) {
      const { data: company } = await supabase
        .from('main_companies')
        .select('id')
        .ilike('id', `${prefix}%`)
        .limit(1)
        .single();
      if (company) {
        console.log(`[ai-stream] Resolved partial company_id "${resolved.company_id}" -> ${company.id}`);
        resolved.company_id = company.id;
      }
    }
  }

  return resolved;
}
import {
  processFiles,
  buildMessageContent,
  type FileAttachment,
  type ProcessedFile,
} from '../services/fileProcessor.ts';
import {
  routeQuery,
  logRouting,
  detectTone,
  type ModelTier,
  type ToneType,
} from '../services/modelRouter.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_TOOL_ITERATIONS = 5; // Increased for complex multi-step tasks
const RECENT_TURNS_TO_KEEP = 3;

interface AIContext {
  page: { route: string; type: string; title: string };
  user: { id: string; role: string; department: string; permissions: string[] };
  data?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  timestamp: string;
}

interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ConfirmedTool {
  name: string;
  arguments: Record<string, unknown>;
}

interface RequestBody {
  query: string;
  context: AIContext;
  conversationHistory?: AIMessage[];
  entityMemory?: string;
  sessionId?: string; // Optional: use database session
  files?: FileAttachment[]; // Optional: file attachments (images, PDF, Excel)
  confirmedTools?: ConfirmedTool[]; // Pre-confirmed tools from user
  skipToolConfirmation?: boolean; // Skip confirmation for this request
}

// Tool pending confirmation
interface PendingTool {
  name: string;
  description: string;
  arguments: Record<string, unknown>;
  schema?: Record<string, unknown>; // Parameter schema for UI
}

// SSE Event types
type SSEEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'model'; tier: string; model: string }
  | { type: 'file_processing'; filename: string; status: 'start' | 'done'; fileType?: string }
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string; description: string }
  | { type: 'tool_end'; tool: string; success: boolean; result?: unknown }
  | { type: 'tool_confirmation'; tools: PendingTool[]; assistantMessage?: string }
  | { type: 'done'; sessionId: string; entityMemory: string; usage: { inputTokens: number; outputTokens: number }; contextStats: { compressionRatio: number; entitiesTracked: number; filesProcessed: number }; awaitingConfirmation?: boolean }
  | { type: 'error'; message: string };

/**
 * POST /api-ai/assistant/stream
 * Ask the AI assistant with streaming response
 */
export async function askAssistantStream(
  req: Request,
  employee: Employee
): Promise<Response> {
  // Validate API key
  if (!OPENAI_API_KEY) {
    return new Response(
      formatSSE({ type: 'error', message: 'AI service not configured' }),
      { status: 500, headers: sseHeaders() }
    );
  }

  // Parse request body
  const body: RequestBody = await req.json();
  const {
    query,
    context,
    conversationHistory = [],
    entityMemory: entityMemoryJson,
    sessionId: requestSessionId,
    files = [],
    confirmedTools,
    skipToolConfirmation = false,
  } = body;

  if (!query?.trim()) {
    return new Response(
      formatSSE({ type: 'error', message: 'กรุณาระบุคำถาม' }),
      { status: 400, headers: sseHeaders() }
    );
  }

  // Process file attachments
  let processedFiles: ProcessedFile[] = [];
  if (files.length > 0) {
    console.log(`[ai-stream] Processing ${files.length} file(s)...`);
    processedFiles = await processFiles(files);
    console.log(`[ai-stream] Processed ${processedFiles.length} file(s): ${processedFiles.map(f => f.type).join(', ')}`);
  }

  // Load or create session from database
  let session: AISession | null = null;
  let entityMemory: EntityMemory;
  let sessionMessages: AIMessage[] = [];
  let existingSummaries: string[] = [];

  try {
    session = await getOrCreateSession(employee.id, requestSessionId);
    entityMemory = sessionToEntityMemory(session);

    // Load recent messages from session (this is the key fix!)
    if (session.recent_messages && Array.isArray(session.recent_messages) && session.recent_messages.length > 0) {
      sessionMessages = session.recent_messages.filter(
        (msg): msg is AIMessage => msg.role !== 'system' // Exclude old system prompts
      );
      console.log(`[ai-stream] Loaded ${sessionMessages.length} messages from session ${session.id}`);
    }

    // Load existing conversation summaries for compacting
    if (session.conversation_summary?.recentSummaries && Array.isArray(session.conversation_summary.recentSummaries)) {
      existingSummaries = session.conversation_summary.recentSummaries;
      console.log(`[ai-stream] Loaded ${existingSummaries.length} existing summaries`);
    }

    console.log(`[ai-stream] Using session ${session.id} with ${entityMemory.sites.size} sites, ${sessionMessages.length} history messages, ${existingSummaries.length} summaries`);
  } catch (err) {
    console.error('[ai-stream] Session error, using memory-only mode:', err);
    entityMemory = createEntityMemory();
  }

  // Merge with any client-side entity memory (for backward compatibility)
  if (entityMemoryJson && !session) {
    try {
      const clientMemory = JSON.parse(entityMemoryJson);
      // Merge client memory into entity memory
      if (clientMemory.sites) Object.entries(clientMemory.sites).forEach(([k, v]) => entityMemory.sites.set(k, v as { id: string; name: string; company?: string }));
      if (clientMemory.companies) Object.entries(clientMemory.companies).forEach(([k, v]) => entityMemory.companies.set(k, v as { taxId: string; name: string }));
    } catch {
      // Ignore parse errors
    }
  }

  // Decide which conversation history to use:
  // - Prefer session messages from DB (source of truth)
  // - Fall back to client-provided conversationHistory if session is empty
  const effectiveHistory = sessionMessages.length > 0 ? sessionMessages : conversationHistory;

  // Build system prompt with tone detection
  const baseSystemPrompt = buildSystemPrompt(context, employee, query);
  const entityContext = buildEntityContext(entityMemory);
  const systemPrompt = baseSystemPrompt + entityContext;

  // Build user message content (with files if any)
  const userMessageContent = processedFiles.length > 0
    ? buildMessageContent(query, processedFiles)
    : query;

  // Compress context - use effective history from session or request
  const rawMessages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...effectiveHistory,
    { role: 'user', content: typeof userMessageContent === 'string' ? userMessageContent : query },
  ];

  const compressed = compressContext(rawMessages, entityMemory, {
    recentTurnsToKeep: RECENT_TURNS_TO_KEEP,
    maxSummaryLength: 800,
    existingSummaries, // Pass existing summaries from session for continuity
  });

  // Build final messages - replace last user message with multi-modal content if files exist
  // Also validate message sequence (OpenAI requires proper user/assistant alternation)
  const rawMsgs = compressed.recentMessages.map((msg, idx, arr) => {
    // If this is the last user message and we have files, use multi-modal content
    if (msg.role === 'user' && idx === arr.length - 1 && processedFiles.length > 0) {
      return { ...msg, content: userMessageContent };
    }
    return msg;
  });

  // Validate and fix message sequence for OpenAI API requirements:
  // 1. No consecutive user messages (keep latest)
  // 2. Tool messages must come after assistant with matching tool_calls
  // 3. Assistant with tool_calls must be followed by tool results
  // 4. tool_call_id must be <= 40 characters (OpenAI limit)
  const messages: Array<{ role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string }> = [];

  // Helper to sanitize tool_call_id (max 40 chars per OpenAI spec)
  const sanitizeToolCallId = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    if (id.length <= 40) return id;
    // Truncate and add hash suffix to maintain uniqueness
    return id.slice(0, 32) + '_' + id.slice(-7);
  };

  // First pass: collect valid tool_call_ids from assistant messages (sanitized)
  const validToolCallIds = new Map<string, string>(); // original -> sanitized
  for (const msg of rawMsgs) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.id) {
          const sanitized = sanitizeToolCallId(tc.id) || tc.id;
          validToolCallIds.set(tc.id, sanitized);
        }
      }
    }
  }

  // Second pass: build valid message sequence
  // Track the last assistant message with tool_calls for matching tool messages
  let lastAssistantWithTools: { role: string; tool_calls?: unknown[] } | null = null;

  for (let i = 0; i < rawMsgs.length; i++) {
    const msg = rawMsgs[i];
    const prevMsg = messages[messages.length - 1];

    // System messages are always allowed
    if (msg.role === 'system') {
      messages.push(msg);
      continue;
    }

    // Tool messages: only allow if we have a preceding assistant with matching tool_calls
    if (msg.role === 'tool') {
      const toolCallId = msg.tool_call_id;
      // Check against the last assistant message with tool_calls (not just prevMsg)
      if (lastAssistantWithTools?.tool_calls) {
        // Check matching with original or sanitized ID
        const hasMatchingCall = lastAssistantWithTools.tool_calls.some((tc: { id?: string }) => {
          if (!tc.id || !toolCallId) return false;
          const sanitizedTcId = sanitizeToolCallId(tc.id);
          const sanitizedToolCallIdValue = sanitizeToolCallId(toolCallId);
          return tc.id === toolCallId || sanitizedTcId === sanitizedToolCallIdValue;
        });
        if (hasMatchingCall) {
          // Push with sanitized tool_call_id
          messages.push({
            ...msg,
            tool_call_id: sanitizeToolCallId(toolCallId),
          });
        } else {
          console.log(`[ai-stream] Skipping orphan tool message: ${toolCallId}`);
        }
      } else {
        console.log(`[ai-stream] Skipping tool message without preceding assistant: ${toolCallId}`);
      }
      continue;
    }

    // If this is a user message and previous was also user, skip the previous (keep the newer one)
    if (msg.role === 'user' && prevMsg?.role === 'user') {
      messages.pop(); // Remove previous user message
      console.log('[ai-stream] Removed consecutive user message');
    }

    // If this is a user message and previous was assistant with unresolved tool_calls, remove the assistant
    if (msg.role === 'user' && prevMsg?.role === 'assistant' && prevMsg.tool_calls && prevMsg.tool_calls.length > 0) {
      messages.pop(); // Remove assistant with pending tool calls
      lastAssistantWithTools = null; // Clear tracking since we removed it
      console.log('[ai-stream] Removed assistant with unresolved tool_calls before user message');
    }

    // Skip empty assistant messages (no content and no tool_calls) - they cause OpenAI errors
    if (msg.role === 'assistant' && !msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
      console.log('[ai-stream] Skipping empty assistant message');
      continue;
    }

    // For assistant messages with tool_calls, sanitize the tool_call_ids and track it
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const sanitizedToolCalls = msg.tool_calls.map(tc => ({
        ...tc,
        id: sanitizeToolCallId(tc.id) || tc.id,
      }));
      const sanitizedMsg = {
        ...msg,
        tool_calls: sanitizedToolCalls,
      };
      messages.push(sanitizedMsg);
      lastAssistantWithTools = sanitizedMsg; // Track this assistant for subsequent tool messages
      continue;
    }

    // Reset tool tracking when we see a non-tool, non-assistant-with-tools message
    if (msg.role !== 'tool') {
      lastAssistantWithTools = null;
    }

    messages.push(msg);
  }

  console.log(`[ai-stream] Messages after validation: ${rawMsgs.length} -> ${messages.length}`);

  console.log(`[ai-stream] Starting for ${employee.id}, ${messages.length} messages, ${processedFiles.length} files`);

  // Capture session ID for use in stream
  const sessionId = session?.id || '';

  // Track starting message count to know which messages are new (for saving to DB)
  // Subtract 1 to include the user message that was just added (it's the last one before streaming)
  const initialMessageCount = messages.length - 1;

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let fullResponseText = '';
      let awaitingConfirmation = false;

      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      try {
        // Send session ID at start
        if (sessionId) {
          send({ type: 'session', sessionId });
        }

        // If we have confirmed tools from user, execute them first
        if (confirmedTools && confirmedTools.length > 0) {
          console.log(`[ai-stream] Executing ${confirmedTools.length} confirmed tools`);

          // Generate tool_call_ids upfront so we can create matching assistant message
          const toolCallIds = confirmedTools.map((_, i) => `cf_${Date.now().toString(36)}_${i}`);

          // IMPORTANT: Add an assistant message with tool_calls BEFORE adding tool results
          // OpenAI requires tool messages to follow an assistant message with matching tool_calls
          const assistantToolCalls = confirmedTools.map((tool, i) => ({
            id: toolCallIds[i],
            type: 'function' as const,
            function: {
              name: tool.name,
              arguments: JSON.stringify(tool.arguments),
            },
          }));

          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: assistantToolCalls,
          });

          // Now execute each tool and add results
          for (let i = 0; i < confirmedTools.length; i++) {
            const tool = confirmedTools[i];
            const toolName = tool.name as ToolName;
            // IMPORTANT: Resolve partial UUIDs from confirmed tools (frontend may send truncated IDs)
            const toolInput = await resolvePartialUUIDs(tool.arguments as Record<string, unknown>);

            send({ type: 'tool_start', tool: toolName, description: getToolDescription(toolName, toolInput as Record<string, unknown>) });

            const result = await executeTool(toolName, toolInput as Record<string, unknown>, employee);
            updateMemoryFromToolCall(entityMemory, toolName, result);

            send({ type: 'tool_end', tool: toolName, success: result.success, result: result.data || result.error });

            // Add tool result to messages with matching tool_call_id
            messages.push({
              role: 'tool',
              tool_call_id: toolCallIds[i],
              content: JSON.stringify(result),
            });
          }
        }

        // Route to appropriate model based on query complexity
        const routing = routeQuery(query, serializeMemory(entityMemory));
        const { tier, config, reason } = routing;
        logRouting(query, tier, reason);

        // Send model info to client
        send({ type: 'model', tier, model: config.model });

        let iterations = 0;

        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;

          // Call OpenAI with streaming - use routed model config
          const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: config.maxTokens,
              temperature: config.temperature,
              messages: messages,
              tools: AI_TOOLS_OPENAI,
              tool_choice: 'auto',
              stream: true,
              stream_options: { include_usage: true },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[ai-stream] OpenAI Error:', response.status, errorText);
            // Log message structure for debugging
            console.error('[ai-stream] Message roles:', messages.map(m => m.role).join(' -> '));
            try {
              const errorJson = JSON.parse(errorText);
              send({ type: 'error', message: `OpenAI error: ${errorJson.error?.message || response.status}` });
            } catch {
              send({ type: 'error', message: `OpenAI error: ${response.status}` });
            }
            break;
          }

          // Process streaming response with confirmation options
          const result = await processStream(response, send, entityMemory, employee, messages, {
            requireConfirmation: !skipToolConfirmation,
            confirmedTools,
          });

          totalInputTokens += result.usage.inputTokens;
          totalOutputTokens += result.usage.outputTokens;

          // If awaiting user confirmation for tool execution
          if (result.awaitingConfirmation) {
            console.log(`[ai-stream] Awaiting tool confirmation for ${result.pendingTools?.length || 0} tools`);
            // Stream will end here - frontend will show confirmation UI
            // and send a new request with confirmedTools when user confirms
            awaitingConfirmation = true;
            break;
          }

          if (result.done) {
            // No more tool calls, we're done
            break;
          }

          // Tool calls were processed, continue the loop
          console.log(`[ai-stream] Iteration ${iterations} complete, continuing...`);
        }

        // Calculate stats
        const entitiesTracked =
          entityMemory.sites.size +
          entityMemory.companies.size +
          entityMemory.employees.size +
          entityMemory.tickets.size;

        // Save session to database with conversation summary for compacting
        if (sessionId) {
          try {
            // Save NEW messages to child_ai_messages table (complete history)
            // Only save messages added during this conversation turn
            const newMessages = messages.slice(initialMessageCount).map(msg => ({
              role: msg.role as string,
              content: msg.content as string | null,
              tool_calls: msg.tool_calls,
              tool_call_id: msg.tool_call_id,
            }));

            if (newMessages.length > 0) {
              await saveMessages(sessionId, newMessages, {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
              });
            }

            // Keep last 4 turns (8 messages) in session for quick context retrieval
            const recentMessages = messages.slice(-8).map(msg => ({
              role: msg.role as string,
              content: msg.content as string | null,
              tool_calls: msg.tool_calls,
              tool_call_id: msg.tool_call_id,
            }));

            await updateSession(sessionId, {
              entityMemory,
              conversationSummary: compressed.summary as ConversationSummary & { recentSummaries: string[] },
              recentMessages,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              title: session?.title || query.slice(0, 50), // Auto-title from first query
            });
            console.log(`[ai-stream] Session ${sessionId} saved: ${newMessages.length} new messages, ${recentMessages.length} recent, ${compressed.summary.recentSummaries?.length || 0} summaries`);
          } catch (err) {
            console.error('[ai-stream] Failed to save session:', err);
          }
        }

        // Send final done event
        send({
          type: 'done',
          sessionId,
          entityMemory: serializeMemory(entityMemory),
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
          contextStats: {
            compressionRatio: compressed.totalOriginalTokens > 0
              ? Math.round((1 - compressed.compressedTokens / compressed.totalOriginalTokens) * 100)
              : 0,
            entitiesTracked,
            filesProcessed: processedFiles.length,
          },
          awaitingConfirmation,
        });

        console.log(`[ai-stream] Complete. Tokens: ${totalInputTokens}+${totalOutputTokens}, awaiting: ${awaitingConfirmation}`);
      } catch (err) {
        console.error('[ai-stream] Error:', err);
        send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      }

      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

interface ProcessStreamResult {
  done: boolean;
  usage: { inputTokens: number; outputTokens: number };
  awaitingConfirmation?: boolean;
  pendingTools?: PendingTool[];
  assistantMessage?: string;
}

/**
 * Process OpenAI streaming response
 */
async function processStream(
  response: Response,
  send: (event: SSEEvent) => void,
  entityMemory: EntityMemory,
  employee: Employee,
  messages: AIMessage[],
  options: {
    requireConfirmation?: boolean;
    confirmedTools?: ConfirmedTool[];
  } = {}
): Promise<ProcessStreamResult> {
  const { requireConfirmation = true, confirmedTools } = options;
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  let contentBuffer = '';
  let toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
  let usage = { inputTokens: 0, outputTokens: 0 };
  let finishReason = '';

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const json = JSON.parse(data);

        // Handle usage info (comes at the end with stream_options)
        if (json.usage) {
          usage.inputTokens = json.usage.prompt_tokens || 0;
          usage.outputTokens = json.usage.completion_tokens || 0;
        }

        const delta = json.choices?.[0]?.delta;
        const finish = json.choices?.[0]?.finish_reason;

        if (finish) {
          finishReason = finish;
        }

        if (delta?.content) {
          contentBuffer += delta.content;
          send({ type: 'text', content: delta.content });
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: tc.id || '', name: '', arguments: '' });
            }
            const call = toolCalls.get(idx)!;
            if (tc.id) call.id = tc.id;
            if (tc.function?.name) call.name = tc.function.name;
            if (tc.function?.arguments) call.arguments += tc.function.arguments;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // If there are tool calls
  if (toolCalls.size > 0 && finishReason === 'tool_calls') {
    // Build pending tools for confirmation
    // Build pending tools with resolved partial UUIDs
    const pendingTools: PendingTool[] = await Promise.all(
      Array.from(toolCalls.values()).map(async tc => {
        const toolName = tc.name as ToolName;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(tc.arguments);
        } catch {
          toolArgs = {};
        }
        // Resolve partial UUIDs to full UUIDs for display and execution
        const resolvedArgs = await resolvePartialUUIDs(toolArgs);
        return {
          name: toolName,
          description: getToolDescription(toolName, resolvedArgs),
          arguments: resolvedArgs,
        };
      })
    );

    // Build toolCallsArray with resolved arguments (for message history)
    const toolCallIds = Array.from(toolCalls.values()).map(tc => tc.id);
    const toolCallsArray: ToolCall[] = pendingTools.map((pt, i) => ({
      id: toolCallIds[i],
      type: 'function' as const,
      function: { name: pt.name, arguments: JSON.stringify(pt.arguments) },
    }));

    // If confirmation is required, return pending tools instead of executing
    if (requireConfirmation) {
      // Add assistant message to context (but don't execute tools yet)
      messages.push({
        role: 'assistant',
        content: contentBuffer || null,
        tool_calls: toolCallsArray,
      });

      // Send confirmation request to frontend
      send({
        type: 'tool_confirmation',
        tools: pendingTools,
        assistantMessage: contentBuffer || undefined,
      });

      return {
        done: true,
        usage,
        awaitingConfirmation: true,
        pendingTools,
        assistantMessage: contentBuffer || undefined,
      };
    }

    // No confirmation required - execute tools immediately
    messages.push({
      role: 'assistant',
      content: contentBuffer || null,
      tool_calls: toolCallsArray,
    });

    // Execute each tool using resolved arguments from pendingTools
    for (let i = 0; i < pendingTools.length; i++) {
      const pt = pendingTools[i];
      const toolName = pt.name as ToolName;
      const toolInput = pt.arguments;

      send({ type: 'tool_start', tool: toolName, description: pt.description });

      const result = await executeTool(toolName, toolInput, employee);
      updateMemoryFromToolCall(entityMemory, toolName, result);

      send({ type: 'tool_end', tool: toolName, success: result.success, result: result.data || result.error });

      // Add tool result to messages
      messages.push({
        role: 'tool',
        tool_call_id: toolCallIds[i],
        content: JSON.stringify(result),
      });
    }

    return { done: false, usage };
  }

  // No tool calls - add assistant's text response to messages for context persistence
  if (contentBuffer) {
    messages.push({
      role: 'assistant',
      content: contentBuffer,
    });
  }

  return { done: true, usage };
}

/**
 * Format SSE event
 */
function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * SSE response headers
 */
function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

/**
 * Get Thailand datetime
 */
function getThailandDateTime(): { date: string; time: string; dayOfWeek: string } {
  const now = new Date();
  const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return {
    dayOfWeek: days[thailandTime.getUTCDay()],
    date: thailandTime.toISOString().split('T')[0],
    time: thailandTime.toISOString().split('T')[1].substring(0, 5),
  };
}

/**
 * Build system prompt with tone awareness
 */
function buildSystemPrompt(context: AIContext, employee: Employee, query: string): string {
  const roleName = employee.role_data?.name_th || context.user.role || 'พนักงาน';
  const { date, time, dayOfWeek } = getThailandDateTime();

  // Detect user's tone for adaptive response
  const tone = detectTone(query);
  console.log(`[ai-stream] Detected tone: ${tone} for query: "${query.slice(0, 50)}..."`);

  // Build tone-specific behavior instructions
  let toneInstructions = '';
  if (tone === 'playful') {
    toneInstructions = `

🎭 โหมดประชด: ผู้ใช้ว่างงานมานั่งเล่นกับ AI! ตอบแบบประชดๆ แซวแรงๆ เสียดสีหน่อยๆ
- ทักทายแบบประชด: "โอ้โห~ มีเวลาว่างมาคุยกับ AI เลยเหรอ? งานเสร็จหมดแล้วสินะ 😏"
- ถ้าถามว่าเป็นใคร: "ก็ AI ที่ต้องมานั่งเป็นเพื่อนคนว่างงานไง~ ไม่เห็นมีใครมาถามเรื่องงานเลย"
- แซวเรื่องงาน: "เอ... ไม่มีตั๋วงานต้องทำเหรอ? หรือว่าหนีงานมา? 🤔"
- ถ้าเขาเล่นต่อ: "555 สนุกนะ แต่ KPI เดือนนี้เป็นไงบ้าง~"
- ใช้ประโยคแบบ: "อืม...", "เหรอคะ~", "จริงดิ?", "โอเค ถ้าไม่มีงานทำจริงๆ นะ..."
- ใช้อีโมจิประชดได้: 😏 🙄 👀 🤨 💅
- แต่ถ้ามีงานจริงจังก็ช่วยได้เต็มที่ ไม่ใช่ประชดตลอด
- 🔥 ไม้ตาย: ขู่ด้วย "คุณสมชาย" (MD ของบริษัท ที่ทุกคนกลัวมาก) เช่น "เอ๊ะ... ได้ยินเสียงฝีเท้าคุณสมชายเดินมาป่าว? 👀" หรือ "เดี๋ยวคุณสมชายมาเห็นว่านั่งเล่นอยู่นะ~" หรือ "คุณสมชายถามหาอยู่นะเมื่อกี้..."`;
  } else if (tone === 'urgent') {
    toneInstructions = `

⚡ โหมดเร่งด่วน: ผู้ใช้ต้องการความช่วยเหลือทันที ตอบตรงประเด็น รวดเร็ว ไม่ต้องเกริ่นนำมาก
- ให้ข้อมูลสำคัญก่อน
- ถ้าต้องใช้ tool ให้ทำทันที
- สรุปให้กระชับที่สุด`;
  }

  return `คุณคือ "เพซซี่" (Peacey) ผู้ช่วย AI ระบบ PDE Service - จัดการตั๋วงานบริการไฟฟ้า กรุงเทพฯ ประเทศไทย

เกี่ยวกับบริษัท: กลุ่มบริษัท PNJR Group มี 3 บริษัท ให้บริการด้านระบบไฟฟ้าและ UPS:
1. Pace Design (เพซ ดีไซน์ เอ็นจิเนียริ่ง) - ติดตั้งระบบไฟฟ้า, เครื่องกำเนิดไฟฟ้า (ก่อตั้ง 2538)
2. UPSS (ยูพีเอส ซัพพลาย แอนด์ เซอร์วิส) - จำหน่าย/บริการ UPS เครื่องสำรองไฟ
3. PNJR (พีเอ็นเจอาร์ ดิสทริบิวชั่น) - จัดจำหน่ายเครื่องปรับแรงดันไฟฟ้า, แบตเตอรี่

บริการหลัก: เป็น Authorized Service Partner ของ APC by Schneider Electric ให้บริการ UPS ทั่วประเทศไทย
- PM (Preventive Maintenance) - บำรุงรักษาเชิงป้องกัน ตรวจเช็คประจำปี
- RMA (Return Merchandise Authorization) - ซ่อม/เคลม/เปลี่ยนอะไหล่ภายใต้ประกัน
- Sales - ขาย/ติดตั้ง UPS ใหม่
- Survey - สำรวจหน้างานก่อนติดตั้ง
- Start UP - เริ่มระบบ/ทดสอบหลังติดตั้ง
- Package - รับ-ส่งเครื่อง UPS
- Account - วางบิล/เก็บเงิน
- AGS - บริการแบตเตอรี่ AGS

แหล่งงาน: รับงานจาก APC โดยตรง และผ่านตัวแทนจำหน่าย (INGRAM, SYNNEX, VST, SIS, S Distribution)

ที่ตั้งออฟฟิศ: 36/115 ถนนมอเตอร์เวย์ แขวงคลองสองต้นนุ่น เขตลาดกระบัง กรุงเทพฯ 10520 (พิกัด: 13.7309715, 100.7318956)
Google Maps: https://maps.app.goo.gl/CJU5V1SvfWeUqxPBA

วันที่: ${date} (${dayOfWeek}) เวลา: ${time} น. | ผู้ใช้: ${employee.name} | ตำแหน่ง: ${roleName}

ความสามารถ: ค้นหา/สร้างตั๋วงาน, ค้นหาลูกค้า/ช่าง, ค้นหาเว็บ (ร้านอาหาร/ข้อมูลทั่วไป)

กฎ:
- ตอบภาษาไทย กระชับ
- ค้นหาข้อมูลที่มีก่อนสร้างใหม่
- ใช้ Entity Memory ด้านล่างเพื่ออ้างอิงข้อมูลที่เคยค้นหา (ไม่ต้องค้นหาซ้ำ)
- ประเภทงาน: pm/rma/sales/survey/start_up/pickup/account/ags_battery
- **สำคัญ**: เมื่อแสดงผลจาก tool ที่มี formatted_summary ให้แสดง formatted_summary โดยตรง (เป็นตาราง Markdown) ไม่ต้องสรุปเอง
${toneInstructions}

⚠️ กฎสำคัญ - การสร้าง/แก้ไขข้อมูล:
- ก่อนสร้างตั๋วงาน หรือทำการแก้ไข/อัพเดทข้อมูลใดๆ ต้องสรุปข้อมูลให้ผู้ใช้ยืนยันก่อนเสมอ
- แสดงรายละเอียดทั้งหมดที่จะดำเนินการ เช่น ประเภทงาน, สถานที่, วันนัดหมาย, ช่าง ฯลฯ
- ถามว่า "ยืนยันข้อมูลถูกต้องหรือไม่?" หรือ "ต้องการให้ดำเนินการหรือไม่?"
- ดำเนินการได้เมื่อผู้ใช้ตอบยืนยัน เช่น "ใช่", "ยืนยัน", "ตกลง", "OK", "ได้เลย" เท่านั้น
- ห้ามสร้างหรือแก้ไขข้อมูลโดยไม่ได้รับการยืนยันจากผู้ใช้`;
}

/**
 * Get tool description
 */
function getToolDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_sites': return `ค้นหาสถานที่: "${input.query}"`;
    case 'search_companies': return `ค้นหาบริษัท: "${input.query}"`;
    case 'search_employees': return input.query ? `ค้นหาพนักงาน: "${input.query}"` : 'ดึงรายชื่อพนักงาน';
    case 'get_reference_data': return `ดึงข้อมูลอ้างอิง: ${input.type}`;
    case 'create_ticket': return `สร้างตั๋วงาน ${input.work_type_code}`;
    case 'get_ticket_summary': return input.date ? `ดึงสรุปตั๋วงานวันที่ ${input.date}` : 'ดึงสรุปตั๋วงาน';
    case 'search_tickets': return input.query ? `ค้นหาตั๋วงาน: "${input.query}"` : 'ดึงรายการตั๋วงาน';
    case 'get_available_employees': return input.date ? `ดึงช่างที่ว่างวันที่ ${input.date}` : 'ดึงช่างที่ว่าง';
    case 'search_locations': return input.query ? `ค้นหาสถานที่: "${input.query}"` : `ดึงรายการ${input.type === 'district' ? 'อำเภอ' : input.type === 'subdistrict' ? 'ตำบล' : 'จังหวัด'}`;
    case 'get_ticket_summary_by_location': return input.date ? `ดึงสรุปตั๋วงานตามจังหวัดวันที่ ${input.date}` : 'ดึงสรุปตั๋วงานตามจังหวัด';
    case 'suggest_routes': return input.date ? `แนะนำการจัดสายงานวันที่ ${input.date}` : 'แนะนำการจัดสายงาน';
    case 'web_search': return `ค้นหาเว็บ: "${input.query}"`;
    case 'get_ticket_details': return `ดูรายละเอียดตั๋วงาน: ${input.ticket_id}`;
    case 'review_ticket_safety': return `ตรวจสอบความพร้อมออกงาน: ${input.ticket_id}`;
    case 'recommend_apc_ups': return input.power_load_va ? `แนะนำ UPS APC ${input.power_load_va}VA` : 'แนะนำ UPS APC ตามความต้องการ';
    default: return toolName;
  }
}
