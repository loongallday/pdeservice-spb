/**
 * Context Manager for AI Assistant
 * Implements smart context compression and entity memory (RAG-like system)
 *
 * Strategy:
 * 1. Keep recent messages (last 2 turns) in full
 * 2. Summarize older messages into compact format
 * 3. Extract and store key entities (IDs, names) in memory
 * 4. Reconstruct context from summary + entity memory when needed
 */

export interface EntityMemory {
  sites: Map<string, { id: string; name: string; company?: string; province?: string; district?: string }>;
  companies: Map<string, { taxId: string; name: string }>;
  employees: Map<string, { id: string; name: string; role?: string }>;
  tickets: Map<string, { id: string; workType: string; site?: string; province?: string }>;
  locations: Map<number, { code: number; name: string; type: 'province' | 'district' | 'subdistrict'; parentName?: string }>;
  preferences: Record<string, string>;
  lastUpdated: string;
}

export interface ConversationSummary {
  topics: string[];
  actions: string[];
  pendingTasks: string[];
  keyDecisions: string[];
}

export interface CompressedContext {
  summary: ConversationSummary;
  entities: EntityMemory;
  recentMessages: AIMessage[];
  totalOriginalTokens: number;
  compressedTokens: number;
}

interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Approximate token count (rough estimate: 1 token ≈ 4 chars for Thai/English mix)
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3);
}

/**
 * Extract entities from tool results
 */
function extractEntitiesFromToolResult(
  toolName: string,
  result: ToolResult,
  memory: EntityMemory
): void {
  if (!result.success || !result.data) return;

  const data = result.data as Record<string, unknown>;

  switch (toolName) {
    case 'search_sites': {
      const sites = Array.isArray(data) ? data : [data];
      for (const site of sites) {
        if (site.id && site.name) {
          const company = site.company as Record<string, string> | undefined;
          memory.sites.set(site.id as string, {
            id: site.id as string,
            name: site.name as string,
            company: company?.name_th || company?.name_en || (site.company_name as string | undefined),
            province: site.province as string | undefined,
            district: site.district as string | undefined,
          });
        }
      }
      break;
    }

    case 'search_companies': {
      const companies = Array.isArray(data) ? data : [data];
      for (const company of companies) {
        if (company.tax_id) {
          memory.companies.set(company.tax_id as string, {
            taxId: company.tax_id as string,
            name: (company.name_th || company.name_en) as string,
          });
        }
      }
      break;
    }

    case 'search_employees': {
      const employees = Array.isArray(data) ? data : [data];
      for (const emp of employees) {
        if (emp.id && emp.name) {
          memory.employees.set(emp.id as string, {
            id: emp.id as string,
            name: emp.name as string,
            role: emp.role_code as string | undefined,
          });
        }
      }
      break;
    }

    case 'create_ticket': {
      if (data.ticket_id) {
        memory.tickets.set(data.ticket_id as string, {
          id: data.ticket_id as string,
          workType: 'created',
          site: data.site_name as string | undefined,
        });
      }
      break;
    }

    case 'search_tickets': {
      const tickets = Array.isArray(data) ? data : [data];
      for (const ticket of tickets) {
        if (ticket.id) {
          const site = ticket.site as Record<string, unknown> | undefined;
          memory.tickets.set(ticket.id as string, {
            id: ticket.id as string,
            workType: (ticket.work_type_code as string) || (ticket.work_type as Record<string, string>)?.code || 'unknown',
            site: (ticket.site_name as string) || (site?.name as string | undefined),
            province: ticket.province as string | undefined,
          });
        }
      }
      break;
    }

    case 'search_locations': {
      const locations = Array.isArray(data) ? data : [data];
      for (const loc of locations) {
        if (loc.code && loc.name_th) {
          memory.locations.set(loc.code as number, {
            code: loc.code as number,
            name: loc.name_th as string,
            type: loc.type as 'province' | 'district' | 'subdistrict',
            parentName: (loc.province_name as string) || (loc.district_name as string),
          });
        }
      }
      break;
    }

    case 'get_ticket_summary_by_location': {
      // Extract provinces from summary data
      const byProvince = (data as Record<string, unknown>).by_province as Array<{ province_code: number; province_name: string; count: number }> | undefined;
      if (byProvince) {
        for (const prov of byProvince) {
          if (prov.province_code && prov.province_code !== 0 && prov.province_name) {
            memory.locations.set(prov.province_code, {
              code: prov.province_code,
              name: prov.province_name,
              type: 'province',
            });
          }
        }
      }
      break;
    }
  }
}

/**
 * Extract key information from user message
 */
function extractFromUserMessage(content: string, memory: EntityMemory): void {
  // Extract preferences from user messages
  const preferencePatterns = [
    { pattern: /ใช้\s*(\S+)\s*เป็นค่าเริ่มต้น/i, key: 'default' },
    { pattern: /เลือก\s*(\S+)/i, key: 'selection' },
    { pattern: /ต้องการ\s*(\S+)/i, key: 'want' },
  ];

  for (const { pattern, key } of preferencePatterns) {
    const match = content.match(pattern);
    if (match) {
      memory.preferences[key] = match[1];
    }
  }
}

/**
 * Summarize a conversation turn into compact format
 */
function summarizeTurn(
  userMessage: string,
  assistantMessage: string | null,
  toolCalls: string[]
): string {
  const parts: string[] = [];

  // Summarize user intent (max 50 chars)
  if (userMessage) {
    const intent = userMessage.length > 50
      ? userMessage.substring(0, 47) + '...'
      : userMessage;
    parts.push(`Q: ${intent}`);
  }

  // Summarize tools used
  if (toolCalls.length > 0) {
    parts.push(`Tools: ${toolCalls.join(', ')}`);
  }

  // Summarize assistant response (max 80 chars)
  if (assistantMessage) {
    const response = assistantMessage.length > 80
      ? assistantMessage.substring(0, 77) + '...'
      : assistantMessage;
    parts.push(`A: ${response}`);
  }

  return parts.join(' | ');
}

/**
 * Create initial empty entity memory
 */
export function createEntityMemory(): EntityMemory {
  return {
    sites: new Map(),
    companies: new Map(),
    employees: new Map(),
    tickets: new Map(),
    locations: new Map(),
    preferences: {},
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Serialize entity memory for storage/transmission
 */
export function serializeMemory(memory: EntityMemory): string {
  return JSON.stringify({
    sites: Object.fromEntries(memory.sites),
    companies: Object.fromEntries(memory.companies),
    employees: Object.fromEntries(memory.employees),
    tickets: Object.fromEntries(memory.tickets),
    locations: Object.fromEntries(memory.locations),
    preferences: memory.preferences,
    lastUpdated: memory.lastUpdated,
  });
}

/**
 * Deserialize entity memory from storage
 */
export function deserializeMemory(json: string): EntityMemory {
  try {
    const data = JSON.parse(json);
    // Convert locations from object entries to Map<number, ...>
    const locationsEntries = Object.entries(data.locations || {}).map(([key, value]) => [Number(key), value] as [number, { code: number; name: string; type: 'province' | 'district' | 'subdistrict'; parentName?: string }]);
    return {
      sites: new Map(Object.entries(data.sites || {})),
      companies: new Map(Object.entries(data.companies || {})),
      employees: new Map(Object.entries(data.employees || {})),
      tickets: new Map(Object.entries(data.tickets || {})),
      locations: new Map(locationsEntries),
      preferences: data.preferences || {},
      lastUpdated: data.lastUpdated || new Date().toISOString(),
    };
  } catch {
    return createEntityMemory();
  }
}

/**
 * Build entity context string for system prompt
 */
export function buildEntityContext(memory: EntityMemory): string {
  const parts: string[] = [];

  // Sites mentioned (include location info)
  if (memory.sites.size > 0) {
    const siteList = Array.from(memory.sites.values())
      .slice(0, 5)
      .map(s => {
        const location = s.province ? ` จ.${s.province}` : '';
        return `${s.name}${s.company ? ` (${s.company})` : ''}${location} [${s.id.slice(0, 8)}]`;
      })
      .join(', ');
    parts.push(`สถานที่ที่กล่าวถึง: ${siteList}`);
  }

  // Companies mentioned
  if (memory.companies.size > 0) {
    const companyList = Array.from(memory.companies.values())
      .slice(0, 5)
      .map(c => `${c.name} [${c.taxId}]`)
      .join(', ');
    parts.push(`บริษัทที่กล่าวถึง: ${companyList}`);
  }

  // Employees mentioned
  if (memory.employees.size > 0) {
    const empList = Array.from(memory.employees.values())
      .slice(0, 5)
      .map(e => `${e.name}${e.role ? ` (${e.role})` : ''} [${e.id.slice(0, 8)}]`)
      .join(', ');
    parts.push(`พนักงานที่กล่าวถึง: ${empList}`);
  }

  // Tickets created/mentioned (include location info)
  if (memory.tickets.size > 0) {
    const ticketList = Array.from(memory.tickets.values())
      .slice(0, 3)
      .map(t => {
        const location = t.province ? ` จ.${t.province}` : '';
        return `${t.workType}${t.site ? ` @${t.site}` : ''}${location} [${t.id.slice(0, 8)}]`;
      })
      .join(', ');
    parts.push(`ตั๋วงานที่เกี่ยวข้อง: ${ticketList}`);
  }

  // Locations mentioned (provinces, districts)
  if (memory.locations && memory.locations.size > 0) {
    const provinces = Array.from(memory.locations.values())
      .filter(l => l.type === 'province')
      .slice(0, 10);
    const districts = Array.from(memory.locations.values())
      .filter(l => l.type === 'district')
      .slice(0, 5);

    if (provinces.length > 0) {
      const provList = provinces.map(p => `${p.name} [รหัส ${p.code}]`).join(', ');
      parts.push(`จังหวัดที่กล่าวถึง: ${provList}`);
    }
    if (districts.length > 0) {
      const distList = districts.map(d => `${d.name}${d.parentName ? ` (${d.parentName})` : ''} [รหัส ${d.code}]`).join(', ');
      parts.push(`อำเภอที่กล่าวถึง: ${distList}`);
    }
  }

  return parts.length > 0 ? '\n\nEntity Memory:\n' + parts.join('\n') : '';
}

/**
 * Compress conversation history while preserving important context
 * (Claude Code style "compacting conversation")
 *
 * Strategy:
 * - Keep last N recent messages in full (configurable)
 * - Summarize older messages into compact summaries
 * - Extract entities from all messages into memory
 * - Store summaries in conversation_summary for persistence
 */
export function compressContext(
  messages: AIMessage[],
  existingMemory?: EntityMemory,
  options: {
    recentTurnsToKeep?: number;
    maxSummaryLength?: number;
    existingSummaries?: string[]; // Previous summaries from DB
  } = {}
): CompressedContext {
  const {
    recentTurnsToKeep = 3,
    maxSummaryLength = 800,
    existingSummaries = [],
  } = options;

  const memory = existingMemory || createEntityMemory();
  const summary: ConversationSummary = {
    topics: [],
    actions: [],
    pendingTasks: [],
    keyDecisions: [],
  };

  // Calculate original token count
  let totalOriginalTokens = 0;
  for (const msg of messages) {
    totalOriginalTokens += estimateTokens(msg.content || '');
  }

  // Separate system message
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  // Find conversation turns (user -> assistant pairs)
  const turns: Array<{
    user: AIMessage | null;
    assistant: AIMessage | null;
    tools: AIMessage[];
  }> = [];

  let currentTurn: { user: AIMessage | null; assistant: AIMessage | null; tools: AIMessage[] } = {
    user: null,
    assistant: null,
    tools: [],
  };

  for (const msg of nonSystemMessages) {
    if (msg.role === 'user') {
      // Start new turn
      if (currentTurn.user) {
        turns.push(currentTurn);
      }
      currentTurn = { user: msg, assistant: null, tools: [] };
    } else if (msg.role === 'assistant') {
      currentTurn.assistant = msg;
    } else if (msg.role === 'tool') {
      currentTurn.tools.push(msg);

      // Extract entities from tool results
      try {
        const result = JSON.parse(msg.content || '{}') as ToolResult;
        // We need to figure out which tool this was - check the tool_call_id
        // For now, just try to extract based on data structure
        if (result.data) {
          const data = result.data as unknown[];
          if (Array.isArray(data) && data.length > 0) {
            const first = data[0] as Record<string, unknown>;
            if ('tax_id' in first && 'name_th' in first) {
              extractEntitiesFromToolResult('search_companies', result, memory);
            } else if ('id' in first && 'name' in first && 'company' in first) {
              extractEntitiesFromToolResult('search_sites', result, memory);
            } else if ('id' in first && 'name' in first && 'role_code' in first) {
              extractEntitiesFromToolResult('search_employees', result, memory);
            } else if ('id' in first && 'work_type' in first) {
              extractEntitiesFromToolResult('search_tickets', result, memory);
            }
          } else if (typeof result.data === 'object' && 'ticket_id' in (result.data as object)) {
            extractEntitiesFromToolResult('create_ticket', result, memory);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Push the last turn
  if (currentTurn.user) {
    turns.push(currentTurn);
  }

  // Extract from user messages
  for (const turn of turns) {
    if (turn.user?.content) {
      extractFromUserMessage(turn.user.content, memory);
    }
  }

  // Split turns into old (to summarize) and recent (to keep)
  const recentTurns = turns.slice(-recentTurnsToKeep);
  const oldTurns = turns.slice(0, -recentTurnsToKeep);

  // Summarize old turns with better detail
  const newSummaries: string[] = [];
  for (const turn of oldTurns) {
    const toolNames = turn.assistant?.tool_calls
      ? (turn.assistant.tool_calls as Array<{ function: { name: string } }>).map(tc => tc.function.name)
      : [];

    const turnSummary = summarizeTurn(
      turn.user?.content || '',
      turn.assistant?.content || null,
      toolNames
    );

    if (turnSummary) {
      newSummaries.push(turnSummary);

      // Extract topics and actions with more detail
      if (turn.user?.content) {
        const content = turn.user.content.toLowerCase();
        if (content.includes('สร้าง') || content.includes('create') || content.includes('เปิด')) {
          summary.actions.push('สร้างข้อมูล');
        }
        if (content.includes('ค้นหา') || content.includes('หา') || content.includes('search') || content.includes('ดู')) {
          summary.actions.push('ค้นหาข้อมูล');
        }
        if (content.includes('แก้ไข') || content.includes('update') || content.includes('เปลี่ยน')) {
          summary.actions.push('แก้ไขข้อมูล');
        }
        // Extract topics from user queries
        if (content.includes('ตั๋ว') || content.includes('ticket')) {
          summary.topics.push('ตั๋วงาน');
        }
        if (content.includes('ลูกค้า') || content.includes('site') || content.includes('สถานที่')) {
          summary.topics.push('ลูกค้า/สถานที่');
        }
        if (content.includes('ช่าง') || content.includes('technician') || content.includes('พนักงาน')) {
          summary.topics.push('พนักงาน');
        }
      }
    }
  }

  // Deduplicate
  summary.actions = [...new Set(summary.actions)];
  summary.topics = [...new Set(summary.topics)];

  // Combine existing summaries with new ones (keep most recent)
  const allSummaries = [...existingSummaries, ...newSummaries].slice(-10); // Keep last 10 summaries

  // Build recent messages array (flatten turns)
  const recentMessages: AIMessage[] = [...systemMessages];
  for (const turn of recentTurns) {
    if (turn.user) recentMessages.push(turn.user);
    for (const tool of turn.tools) recentMessages.push(tool);
    if (turn.assistant) recentMessages.push(turn.assistant);
  }

  // Add summary as a condensed message if there are old summaries
  if (allSummaries.length > 0) {
    const summaryText = allSummaries.join('\n');
    const truncatedSummary = summaryText.length > maxSummaryLength
      ? summaryText.substring(0, maxSummaryLength - 3) + '...'
      : summaryText;

    // Build context header
    const contextParts: string[] = [];

    // Add topics if any
    if (summary.topics.length > 0) {
      contextParts.push(`หัวข้อที่พูดถึง: ${summary.topics.join(', ')}`);
    }

    // Add actions if any
    if (summary.actions.length > 0) {
      contextParts.push(`การดำเนินการ: ${summary.actions.join(', ')}`);
    }

    // Add turn summaries
    contextParts.push(`\nประวัติบทสนทนา:\n${truncatedSummary}`);

    // Insert summary after system message
    recentMessages.splice(systemMessages.length, 0, {
      role: 'system',
      content: `[สรุปบทสนทนาก่อนหน้า - ${allSummaries.length} turns]\n${contextParts.join('\n')}`,
    });
  }

  // Calculate compressed token count
  let compressedTokens = 0;
  for (const msg of recentMessages) {
    compressedTokens += estimateTokens(msg.content || '');
  }

  memory.lastUpdated = new Date().toISOString();

  // Store summaries in the summary object for persistence
  const summaryWithRecent = {
    ...summary,
    recentSummaries: allSummaries,
  };

  return {
    summary: summaryWithRecent,
    entities: memory,
    recentMessages,
    totalOriginalTokens,
    compressedTokens,
  };
}

/**
 * Process tool results and update entity memory
 */
export function updateMemoryFromToolCall(
  memory: EntityMemory,
  toolName: string,
  result: ToolResult
): void {
  extractEntitiesFromToolResult(toolName, result, memory);
  memory.lastUpdated = new Date().toISOString();
}
