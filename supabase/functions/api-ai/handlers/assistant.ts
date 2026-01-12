/**
 * AI Assistant Handler
 * Handles AI chat requests using OpenAI ChatGPT with tool calling
 * Implements smart context compression (RAG-like) for token efficiency
 */

import { success, error } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import type { Employee } from '../../_shared/auth.ts';
import { AI_TOOLS_OPENAI, type ToolName } from '../services/toolDefinitions.ts';
import { executeTool } from '../services/toolExecutor.ts';
import {
  compressContext,
  createEntityMemory,
  deserializeMemory,
  serializeMemory,
  buildEntityContext,
  updateMemoryFromToolCall,
  type EntityMemory,
  type ConversationSummary,
} from '../services/contextManager.ts';
import {
  routeQuery,
  logRouting,
  detectTone,
  type ToneType,
} from '../services/modelRouter.ts';
import {
  getOrCreateSession,
  updateSession,
  sessionToEntityMemory,
  type AISession,
} from '../services/sessionService.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_TOOL_ITERATIONS = 5;
const RECENT_TURNS_TO_KEEP = 3;

interface AIContext {
  page: {
    route: string;
    type: string;
    title: string;
  };
  user: {
    id: string;
    role: string;
    department: string;
    permissions: string[];
  };
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
  function: {
    name: string;
    arguments: string;
  };
}

interface RequestBody {
  query: string;
  context: AIContext;
  conversationHistory?: AIMessage[];
  entityMemory?: string; // Serialized EntityMemory from frontend
  sessionId?: string; // Optional: use database session
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface AssistantResponse {
  response: {
    message: string;
    confidence: number;
    suggestions: string[];
    actions: Array<{
      type: string;
      description: string;
      result?: unknown;
    }>;
  };
  model: {
    tier: string;
    name: string;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  entityMemory: string; // Serialized EntityMemory for frontend to persist
  sessionId: string; // Session ID for continuity
  contextStats: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    entitiesTracked: number;
  };
}

/**
 * POST /api-ai/assistant
 * Ask the AI assistant a question with smart context compression
 */
export async function askAssistant(
  req: Request,
  employee: Employee
): Promise<Response> {
  // Validate API key is configured
  if (!OPENAI_API_KEY) {
    console.error('[ai] OPENAI_API_KEY not set');
    return error('AI service not configured. Please set OPENAI_API_KEY.', 500);
  }

  // Parse request body
  const body: RequestBody = await req.json();
  const { query, context, conversationHistory = [], entityMemory: entityMemoryJson, sessionId: requestSessionId } = body;

  // Validate query
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new ValidationError('กรุณาระบุคำถาม');
  }

  // Load or create session from database (same as streaming handler)
  let session: AISession | null = null;
  let entityMemory: EntityMemory;
  let sessionMessages: AIMessage[] = [];
  let existingSummaries: string[] = [];

  try {
    session = await getOrCreateSession(employee.id, requestSessionId);
    entityMemory = sessionToEntityMemory(session);

    // Load recent messages from session
    if (session.recent_messages && Array.isArray(session.recent_messages) && session.recent_messages.length > 0) {
      sessionMessages = session.recent_messages.filter(
        (msg): msg is AIMessage => msg.role !== 'system'
      );
      console.log(`[ai] Loaded ${sessionMessages.length} messages from session ${session.id}`);
    }

    // Load existing conversation summaries for compacting
    if (session.conversation_summary?.recentSummaries && Array.isArray(session.conversation_summary.recentSummaries)) {
      existingSummaries = session.conversation_summary.recentSummaries;
      console.log(`[ai] Loaded ${existingSummaries.length} existing summaries`);
    }

    console.log(`[ai] Using session ${session.id} with ${entityMemory.sites.size} sites, ${sessionMessages.length} history messages`);
  } catch (err) {
    console.error('[ai] Session error, using memory-only mode:', err);
    // Fallback to client-provided entity memory
    if (entityMemoryJson) {
      entityMemory = deserializeMemory(entityMemoryJson);
      console.log(`[ai] Restored entity memory with ${entityMemory.sites.size} sites, ${entityMemory.companies.size} companies`);
    } else {
      entityMemory = createEntityMemory();
      console.log('[ai] Created new entity memory');
    }
  }

  // Decide which conversation history to use
  const effectiveHistory = sessionMessages.length > 0 ? sessionMessages : conversationHistory;

  // Build system prompt with entity context and tone detection
  const baseSystemPrompt = buildSystemPrompt(context, employee, query);
  const entityContext = buildEntityContext(entityMemory);
  const systemPrompt = baseSystemPrompt + entityContext;

  // Build initial messages for compression
  const rawMessages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...effectiveHistory,
    { role: 'user', content: query },
  ];

  // Compress context - summarize old turns, keep recent
  const compressed = compressContext(rawMessages, entityMemory, {
    recentTurnsToKeep: RECENT_TURNS_TO_KEEP,
    maxSummaryLength: 800,
    existingSummaries,
  });

  console.log(`[ai] Context compression: ${compressed.totalOriginalTokens} -> ${compressed.compressedTokens} tokens (${Math.round((1 - compressed.compressedTokens / Math.max(1, compressed.totalOriginalTokens)) * 100)}% reduction)`);

  // Use compressed messages
  const messages: AIMessage[] = compressed.recentMessages;

  // Route to appropriate model based on query complexity
  const routing = routeQuery(query, serializeMemory(entityMemory));
  const { tier, config, reason } = routing;
  logRouting(query, tier, reason);

  console.log(`[ai] Starting conversation for employee ${employee.id} with ${messages.length} messages, model=${config.model}...`);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const actionsPerformed: Array<{ type: string; description: string; result?: unknown }> = [];

  // Tool calling loop
  let iterations = 0;
  let finalMessage = '';

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    // Call OpenAI API with routed model config
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ai] OpenAI API Error:', errorText);
      return error(`OpenAI API error: ${response.status}`, 500);
    }

    const data: OpenAIResponse = await response.json();
    totalInputTokens += data.usage.prompt_tokens;
    totalOutputTokens += data.usage.completion_tokens;

    const choice = data.choices[0];
    console.log(`[ai] Iteration ${iterations}: finish_reason=${choice.finish_reason}, tokens=${data.usage.total_tokens}`);

    // If OpenAI wants to use tools
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      // Add assistant's response to messages
      messages.push({
        role: 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      });

      // Process each tool call
      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name as ToolName;
        const toolInput = JSON.parse(toolCall.function.arguments);

        console.log(`[ai] Executing tool: ${toolName}`);

        const result = await executeTool(toolName, toolInput, employee);

        // Update entity memory with tool results
        updateMemoryFromToolCall(entityMemory, toolName, result);

        // Track action
        actionsPerformed.push({
          type: toolName,
          description: getToolDescription(toolName, toolInput),
          result: result.success ? result.data : result.error,
        });

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      // OpenAI is done
      finalMessage = choice.message.content || '';
      break;
    }
  }

  // Calculate entities tracked
  const entitiesTracked =
    entityMemory.sites.size +
    entityMemory.companies.size +
    entityMemory.employees.size +
    entityMemory.tickets.size;

  // Save session to database with conversation summary for compacting
  const sessionId = session?.id || '';
  if (sessionId) {
    try {
      // Keep last 4 turns (8 messages) for better context retention
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
        title: session?.title || query.slice(0, 50),
      });
      console.log(`[ai] Session ${sessionId} saved with ${recentMessages.length} messages`);
    } catch (err) {
      console.error('[ai] Failed to save session:', err);
    }
  }

  // Return formatted response with entity memory for frontend persistence
  const result: AssistantResponse = {
    response: {
      message: finalMessage,
      confidence: 0.85,
      suggestions: [],
      actions: actionsPerformed,
    },
    model: {
      tier,
      name: config.model,
    },
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
    entityMemory: serializeMemory(entityMemory),
    sessionId, // Include session ID in response
    contextStats: {
      originalTokens: compressed.totalOriginalTokens,
      compressedTokens: compressed.compressedTokens,
      compressionRatio: compressed.totalOriginalTokens > 0
        ? Math.round((1 - compressed.compressedTokens / compressed.totalOriginalTokens) * 100)
        : 0,
      entitiesTracked,
    },
  };

  console.log(`[ai] Response complete. Entities tracked: ${entitiesTracked}`);

  return success(result);
}

/**
 * Get current date/time in Thailand (GMT+7)
 */
function getThailandDateTime(): { date: string; time: string; dayOfWeek: string } {
  const now = new Date();
  const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const dayOfWeek = days[thailandTime.getUTCDay()];
  const date = thailandTime.toISOString().split('T')[0];
  const time = thailandTime.toISOString().split('T')[1].substring(0, 5);
  return { date, time, dayOfWeek };
}

/**
 * Build system prompt with tone awareness
 */
function buildSystemPrompt(context: AIContext, employee: Employee, query: string): string {
  const roleName = employee.role_data?.name_th || context.user.role || 'พนักงาน';
  const { date, time, dayOfWeek } = getThailandDateTime();

  // Detect user's tone for adaptive response
  const tone = detectTone(query);
  console.log(`[ai] Detected tone: ${tone} for query: "${query.slice(0, 50)}..."`);

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
 * Get human-readable description for tool execution
 */
function getToolDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_sites':
      return `ค้นหาสถานที่: "${input.query}"`;
    case 'search_companies':
      return `ค้นหาบริษัท: "${input.query}"`;
    case 'search_employees':
      return input.query ? `ค้นหาพนักงาน: "${input.query}"` : 'ดึงรายชื่อพนักงาน';
    case 'get_reference_data':
      return `ดึงข้อมูลอ้างอิง: ${input.type}`;
    case 'create_ticket':
      return `สร้างตั๋วงาน ${input.work_type_code}`;
    case 'get_ticket_summary':
      return input.date ? `ดึงสรุปตั๋วงานวันที่ ${input.date}` : 'ดึงสรุปตั๋วงาน';
    case 'search_tickets':
      return input.query ? `ค้นหาตั๋วงาน: "${input.query}"` : 'ดึงรายการตั๋วงาน';
    case 'get_available_employees':
      return input.date ? `ดึงช่างที่ว่างวันที่ ${input.date}` : 'ดึงช่างที่ว่าง';
    case 'search_locations':
      return input.query ? `ค้นหาสถานที่: "${input.query}"` : `ดึงรายการ${input.type === 'district' ? 'อำเภอ' : input.type === 'subdistrict' ? 'ตำบล' : 'จังหวัด'}`;
    case 'get_ticket_summary_by_location':
      return input.date ? `ดึงสรุปตั๋วงานตามจังหวัดวันที่ ${input.date}` : 'ดึงสรุปตั๋วงานตามจังหวัด';
    case 'suggest_routes':
      return input.date ? `แนะนำการจัดสายงานวันที่ ${input.date}` : 'แนะนำการจัดสายงาน';
    case 'web_search':
      return `ค้นหาเว็บ: "${input.query}"`;
    case 'get_ticket_details':
      return `ดูรายละเอียดตั๋วงาน: ${input.ticket_id}`;
    case 'review_ticket_safety':
      return `ตรวจสอบความพร้อมออกงาน: ${input.ticket_id}`;
    case 'recommend_apc_ups':
      return input.power_load_va ? `แนะนำ UPS APC ${input.power_load_va}VA` : 'แนะนำ UPS APC ตามความต้องการ';
    default:
      return toolName;
  }
}
