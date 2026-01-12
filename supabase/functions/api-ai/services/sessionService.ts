/**
 * AI Session Service
 * Handles persistence of AI conversation sessions to database
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import type { EntityMemory, ConversationSummary } from './contextManager.ts';

export interface AISession {
  id: string;
  employee_id: string;
  entity_memory: {
    sites: Record<string, { id: string; name: string; company?: string }>;
    companies: Record<string, { taxId: string; name: string }>;
    employees: Record<string, { id: string; name: string; role?: string }>;
    tickets: Record<string, { id: string; workType: string; site?: string }>;
    preferences: Record<string, string>;
  };
  conversation_summary: ConversationSummary & {
    recentSummaries: string[];
  };
  recent_messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }>;
  title: string | null;
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

/**
 * Get or create a session for an employee
 */
export async function getOrCreateSession(
  employeeId: string,
  sessionId?: string
): Promise<AISession> {
  const supabase = createServiceClient();

  // If sessionId provided, try to load it
  if (sessionId) {
    const { data, error } = await supabase
      .from('main_ai_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('employee_id', employeeId)
      .single();

    if (!error && data) {
      return data as AISession;
    }
  }

  // Get most recent session or create new one
  const { data: existing } = await supabase
    .from('main_ai_sessions')
    .select('*')
    .eq('employee_id', employeeId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    // Check if session is recent (within 30 minutes)
    const lastMessage = new Date(existing.last_message_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastMessage.getTime()) / (1000 * 60);

    if (diffMinutes < 30) {
      return existing as AISession;
    }
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from('main_ai_sessions')
    .insert({ employee_id: employeeId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return newSession as AISession;
}

/**
 * Update session with new data after a conversation turn
 */
export async function updateSession(
  sessionId: string,
  updates: {
    entityMemory?: EntityMemory;
    conversationSummary?: ConversationSummary & { recentSummaries: string[] };
    recentMessages?: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }>;
    title?: string;
    inputTokens?: number;
    outputTokens?: number;
  }
): Promise<void> {
  const supabase = createServiceClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.entityMemory) {
    updateData.entity_memory = {
      sites: Object.fromEntries(updates.entityMemory.sites),
      companies: Object.fromEntries(updates.entityMemory.companies),
      employees: Object.fromEntries(updates.entityMemory.employees),
      tickets: Object.fromEntries(updates.entityMemory.tickets),
      locations: Object.fromEntries(updates.entityMemory.locations || new Map()),
      preferences: updates.entityMemory.preferences,
    };
  }

  if (updates.conversationSummary) {
    updateData.conversation_summary = updates.conversationSummary;
  }

  if (updates.recentMessages) {
    updateData.recent_messages = updates.recentMessages;
  }

  if (updates.title) {
    updateData.title = updates.title;
  }

  // First, update the basic fields
  const { error: updateError } = await supabase
    .from('main_ai_sessions')
    .update(updateData)
    .eq('id', sessionId);

  if (updateError) {
    console.error('[session] Update error:', updateError);
  }

  // Then use RPC to atomically increment tokens and message count
  const { error: rpcError } = await supabase.rpc('update_ai_session_tokens', {
    p_session_id: sessionId,
    p_input_tokens: updates.inputTokens || 0,
    p_output_tokens: updates.outputTokens || 0,
  });

  if (rpcError) {
    console.error('[session] Token update error:', rpcError);
  }
}

/**
 * Convert database session to EntityMemory
 */
export function sessionToEntityMemory(session: AISession): EntityMemory {
  const em = session.entity_memory || {};
  // Convert locations from object entries to Map<number, ...>
  const locationsObj = (em as Record<string, unknown>).locations as Record<string, unknown> || {};
  const locationsEntries = Object.entries(locationsObj).map(([key, value]) => [Number(key), value] as [number, { code: number; name: string; type: 'province' | 'district' | 'subdistrict'; parentName?: string }]);
  return {
    sites: new Map(Object.entries(em.sites || {})),
    companies: new Map(Object.entries(em.companies || {})),
    employees: new Map(Object.entries(em.employees || {})),
    tickets: new Map(Object.entries(em.tickets || {})),
    locations: new Map(locationsEntries),
    preferences: em.preferences || {},
    lastUpdated: session.updated_at,
  };
}

/**
 * List sessions for an employee
 */
export async function listSessions(
  employeeId: string,
  limit = 10
): Promise<Array<{ id: string; title: string | null; message_count: number; last_message_at: string }>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_ai_sessions')
    .select('id, title, message_count, last_message_at')
    .eq('employee_id', employeeId)
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list sessions: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string, employeeId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('main_ai_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('employee_id', employeeId);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

/**
 * Delete all sessions for an employee
 */
export async function deleteAllSessions(employeeId: string): Promise<number> {
  const supabase = createServiceClient();

  // First count how many will be deleted
  const { count } = await supabase
    .from('main_ai_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('employee_id', employeeId);

  // Delete all sessions (child_ai_messages will cascade delete)
  const { error } = await supabase
    .from('main_ai_sessions')
    .delete()
    .eq('employee_id', employeeId);

  if (error) {
    throw new Error(`Failed to delete sessions: ${error.message}`);
  }

  return count || 0;
}

/**
 * Max sessions per employee - older sessions are auto-deleted
 */
const MAX_SESSIONS_PER_USER = 10;

/**
 * Cleanup old sessions, keeping only the most recent MAX_SESSIONS_PER_USER
 */
export async function cleanupOldSessions(employeeId: string): Promise<number> {
  const supabase = createServiceClient();

  // Get all session IDs ordered by last_message_at, skip the most recent ones
  const { data: sessionsToDelete, error: selectError } = await supabase
    .from('main_ai_sessions')
    .select('id')
    .eq('employee_id', employeeId)
    .order('last_message_at', { ascending: false })
    .range(MAX_SESSIONS_PER_USER, 1000); // Skip first MAX_SESSIONS, get the rest

  if (selectError) {
    console.error('[session] Cleanup select error:', selectError.message);
    return 0;
  }

  if (!sessionsToDelete || sessionsToDelete.length === 0) {
    return 0;
  }

  const idsToDelete = sessionsToDelete.map(s => s.id);

  // Delete old sessions
  const { error: deleteError } = await supabase
    .from('main_ai_sessions')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('[session] Cleanup delete error:', deleteError.message);
    return 0;
  }

  console.log(`[session] Cleaned up ${idsToDelete.length} old sessions for employee ${employeeId}`);
  return idsToDelete.length;
}

/**
 * Create a new session (force new, don't reuse)
 * Also cleans up old sessions if count exceeds MAX_SESSIONS_PER_USER
 */
export async function createNewSession(employeeId: string): Promise<AISession> {
  const supabase = createServiceClient();

  // Create new session
  const { data, error } = await supabase
    .from('main_ai_sessions')
    .insert({ employee_id: employeeId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  // Cleanup old sessions in background (don't block the response)
  cleanupOldSessions(employeeId).catch(err => {
    console.error('[session] Background cleanup failed:', err);
  });

  return data as AISession;
}

/**
 * Message type for persistent storage
 */
export interface StoredMessage {
  id?: string;
  session_id: string;
  sequence_number: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
}

/**
 * Get the next sequence number for a session
 */
async function getNextSequenceNumber(sessionId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('child_ai_messages')
    .select('sequence_number')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single();

  return (data?.sequence_number || 0) + 1;
}

/**
 * Save new messages to the database
 * Returns the starting sequence number used
 */
export async function saveMessages(
  sessionId: string,
  messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }>,
  tokenUsage?: { inputTokens?: number; outputTokens?: number }
): Promise<number> {
  if (messages.length === 0) return 0;

  const supabase = createServiceClient();
  const startSequence = await getNextSequenceNumber(sessionId);

  // Prepare messages for insertion
  const messagesToInsert = messages.map((msg, index) => ({
    session_id: sessionId,
    sequence_number: startSequence + index,
    role: msg.role,
    content: msg.content,
    tool_calls: msg.tool_calls || null,
    tool_call_id: msg.tool_call_id || null,
    // Assign tokens to the last message (assistant response)
    input_tokens: index === messages.length - 1 ? (tokenUsage?.inputTokens || 0) : 0,
    output_tokens: index === messages.length - 1 ? (tokenUsage?.outputTokens || 0) : 0,
  }));

  const { error } = await supabase
    .from('child_ai_messages')
    .insert(messagesToInsert);

  if (error) {
    console.error('[session] Failed to save messages:', error.message);
  } else {
    console.log(`[session] Saved ${messages.length} messages to session ${sessionId}`);
  }

  return startSequence;
}

/**
 * Load messages from a session
 * @param sessionId - The session ID
 * @param limit - Maximum number of messages to load (0 = all)
 * @param offset - Number of messages to skip from the start
 */
export async function loadMessages(
  sessionId: string,
  options?: {
    limit?: number;
    offset?: number;
    afterSequence?: number;
  }
): Promise<StoredMessage[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('child_ai_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });

  if (options?.afterSequence !== undefined) {
    query = query.gt('sequence_number', options.afterSequence);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  } else if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[session] Failed to load messages:', error.message);
    return [];
  }

  return (data || []) as StoredMessage[];
}

/**
 * Load recent messages for context (last N messages)
 */
export async function loadRecentMessages(
  sessionId: string,
  count: number
): Promise<StoredMessage[]> {
  const supabase = createServiceClient();

  // First get the max sequence number
  const { data: maxData } = await supabase
    .from('child_ai_messages')
    .select('sequence_number')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single();

  const maxSequence = maxData?.sequence_number || 0;
  const startSequence = Math.max(1, maxSequence - count + 1);

  // Then fetch messages from that sequence onward
  const { data, error } = await supabase
    .from('child_ai_messages')
    .select('*')
    .eq('session_id', sessionId)
    .gte('sequence_number', startSequence)
    .order('sequence_number', { ascending: true });

  if (error) {
    console.error('[session] Failed to load recent messages:', error.message);
    return [];
  }

  return (data || []) as StoredMessage[];
}

/**
 * Get message count for a session
 */
export async function getMessageCount(sessionId: string): Promise<number> {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('child_ai_messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (error) {
    console.error('[session] Failed to get message count:', error.message);
    return 0;
  }

  return count || 0;
}
