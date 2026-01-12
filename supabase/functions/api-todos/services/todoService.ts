/**
 * Todo Service - Business logic for todo/reminder management
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError, ValidationError, AuthorizationError } from '../../_shared/error.ts';

export type TodoPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TodoInput {
  title: string;
  description?: string;
  deadline: string; // ISO datetime string
  assignee_id: string;
  ticket_id?: string;
  priority?: TodoPriority;
}

export interface TodoInfo {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  ticket_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  notified_at: string | null;
  priority: TodoPriority;
  creator: {
    id: string;
    code: string;
    name: string;
    nickname: string | null;
  };
  assignee: {
    id: string;
    code: string;
    name: string;
    nickname: string | null;
  };
  ticket?: {
    id: string;
    code: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface TodoListParams {
  page: number;
  limit: number;
  assigneeId?: string;
  creatorId?: string;
  isCompleted?: boolean;
  priority?: TodoPriority;
  ticketId?: string;
  fromDate?: string;
  toDate?: string;
  own?: boolean;
  searchTerm?: string;
}

export class TodoService {
  /**
   * Validate todo input
   */
  private static validateInput(input: TodoInput, isUpdate = false): void {
    if (!isUpdate && !input.title?.trim()) {
      throw new ValidationError('กรุณาระบุหัวข้องาน');
    }

    if (!isUpdate && !input.deadline) {
      throw new ValidationError('กรุณาระบุกำหนดเวลา');
    }

    if (input.deadline) {
      const deadlineDate = new Date(input.deadline);
      if (isNaN(deadlineDate.getTime())) {
        throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง');
      }
    }

    if (!isUpdate && !input.assignee_id) {
      throw new ValidationError('กรุณาระบุผู้รับผิดชอบ');
    }

    if (input.priority && !['low', 'normal', 'high', 'urgent'].includes(input.priority)) {
      throw new ValidationError('ความสำคัญไม่ถูกต้อง');
    }
  }

  /**
   * Transform database row to TodoInfo
   */
  private static transformToTodoInfo(row: Record<string, unknown>): TodoInfo {
    const creator = row.creator as Record<string, unknown>;
    const assignee = row.assignee as Record<string, unknown>;
    const ticket = row.ticket as Record<string, unknown> | null;

    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      deadline: row.deadline as string,
      ticket_id: row.ticket_id as string | null,
      is_completed: row.is_completed as boolean,
      completed_at: row.completed_at as string | null,
      notified_at: row.notified_at as string | null,
      priority: row.priority as TodoPriority,
      creator: {
        id: creator.id as string,
        code: creator.code as string,
        name: creator.name as string,
        nickname: creator.nickname as string | null,
      },
      assignee: {
        id: assignee.id as string,
        code: assignee.code as string,
        name: assignee.name as string,
        nickname: assignee.nickname as string | null,
      },
      ticket: ticket ? {
        id: ticket.id as string,
        code: ticket.ticket_code as string,
      } : null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  /**
   * Get base select query
   */
  private static getSelectQuery(): string {
    return `
      id,
      title,
      description,
      deadline,
      ticket_id,
      is_completed,
      completed_at,
      notified_at,
      priority,
      created_at,
      updated_at,
      creator:main_employees!fk_todo_creator(
        id, code, name, nickname
      ),
      assignee:main_employees!fk_todo_assignee(
        id, code, name, nickname
      ),
      ticket:main_tickets!fk_todo_ticket(
        id, ticket_code
      )
    `;
  }

  /**
   * List todos with filters and pagination
   */
  static async list(
    employeeId: string,
    employeeLevel: number,
    params: TodoListParams
  ): Promise<{ data: TodoInfo[]; total: number }> {
    const supabase = createServiceClient();
    const { page, limit, assigneeId, creatorId, isCompleted, priority, ticketId, fromDate, toDate, own, searchTerm } = params;

    let query = supabase
      .from('main_todos')
      .select(this.getSelectQuery(), { count: 'exact' });

    // Level 2+ can see all, others can only see their own
    // If own=true, filter to user's own todos regardless of level
    if (employeeLevel < 2 || own) {
      query = query.or(`creator_id.eq.${employeeId},assignee_id.eq.${employeeId}`);
    }

    // Apply filters
    if (assigneeId) {
      query = query.eq('assignee_id', assigneeId);
    }
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }
    if (isCompleted !== undefined) {
      query = query.eq('is_completed', isCompleted);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (ticketId) {
      query = query.eq('ticket_id', ticketId);
    }
    if (fromDate) {
      query = query.gte('deadline', fromDate);
    }
    if (toDate) {
      query = query.lte('deadline', toDate);
    }
    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    // Pagination and ordering
    const offset = (page - 1) * limit;
    query = query
      .order('deadline', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[todo] Failed to list todos:', error);
      throw new DatabaseError(`ไม่สามารถดึงรายการงานได้: ${error.message}`);
    }

    return {
      data: (data || []).map(row => this.transformToTodoInfo(row)),
      total: count || 0,
    };
  }

  /**
   * Get single todo by ID
   */
  static async getById(
    todoId: string,
    employeeId: string,
    employeeLevel: number
  ): Promise<TodoInfo> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_todos')
      .select(this.getSelectQuery())
      .eq('id', todoId)
      .single();

    if (error || !data) {
      throw new NotFoundError('ไม่พบงานที่ต้องการ');
    }

    // Check access
    const todo = this.transformToTodoInfo(data);
    if (employeeLevel < 2 && todo.creator.id !== employeeId && todo.assignee.id !== employeeId) {
      throw new AuthorizationError('ไม่มีสิทธิ์ดูงานนี้');
    }

    return todo;
  }

  /**
   * Create new todo
   */
  static async create(creatorId: string, input: TodoInput): Promise<TodoInfo> {
    this.validateInput(input);

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_todos')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        deadline: input.deadline,
        assignee_id: input.assignee_id,
        creator_id: creatorId,
        ticket_id: input.ticket_id || null,
        priority: input.priority || 'normal',
      })
      .select(this.getSelectQuery())
      .single();

    if (error) {
      console.error('[todo] Failed to create todo:', error);
      throw new DatabaseError(`ไม่สามารถสร้างงานได้: ${error.message}`);
    }

    return this.transformToTodoInfo(data);
  }

  /**
   * Update todo
   */
  static async update(
    todoId: string,
    employeeId: string,
    employeeLevel: number,
    input: Partial<TodoInput>
  ): Promise<TodoInfo> {
    this.validateInput(input as TodoInput, true);

    const supabase = createServiceClient();

    // Check if todo exists and user has permission
    const existing = await this.getById(todoId, employeeId, employeeLevel);
    if (employeeLevel < 2 && existing.creator.id !== employeeId) {
      throw new AuthorizationError('ไม่มีสิทธิ์แก้ไขงานนี้');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.deadline !== undefined) updateData.deadline = input.deadline;
    if (input.assignee_id !== undefined) updateData.assignee_id = input.assignee_id;
    if (input.ticket_id !== undefined) updateData.ticket_id = input.ticket_id || null;
    if (input.priority !== undefined) updateData.priority = input.priority;

    // Reset notification if deadline changed
    if (input.deadline !== undefined) {
      updateData.notified_at = null;
    }

    const { data, error } = await supabase
      .from('main_todos')
      .update(updateData)
      .eq('id', todoId)
      .select(this.getSelectQuery())
      .single();

    if (error) {
      console.error('[todo] Failed to update todo:', error);
      throw new DatabaseError(`ไม่สามารถแก้ไขงานได้: ${error.message}`);
    }

    return this.transformToTodoInfo(data);
  }

  /**
   * Delete todo
   */
  static async delete(
    todoId: string,
    employeeId: string,
    employeeLevel: number
  ): Promise<void> {
    const supabase = createServiceClient();

    // Check if todo exists and user has permission
    const existing = await this.getById(todoId, employeeId, employeeLevel);
    if (employeeLevel < 2 && existing.creator.id !== employeeId) {
      throw new AuthorizationError('ไม่มีสิทธิ์ลบงานนี้');
    }

    const { error } = await supabase
      .from('main_todos')
      .delete()
      .eq('id', todoId);

    if (error) {
      console.error('[todo] Failed to delete todo:', error);
      throw new DatabaseError(`ไม่สามารถลบงานได้: ${error.message}`);
    }
  }

  /**
   * Mark todo as completed
   */
  static async complete(
    todoId: string,
    employeeId: string,
    employeeLevel: number
  ): Promise<TodoInfo> {
    const supabase = createServiceClient();

    // Check if todo exists and user has permission
    const existing = await this.getById(todoId, employeeId, employeeLevel);

    // Creator or assignee can complete
    if (existing.creator.id !== employeeId && existing.assignee.id !== employeeId && employeeLevel < 2) {
      throw new AuthorizationError('ไม่มีสิทธิ์ทำเครื่องหมายงานนี้');
    }

    if (existing.is_completed) {
      throw new ValidationError('งานนี้เสร็จสิ้นแล้ว');
    }

    const { data, error } = await supabase
      .from('main_todos')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', todoId)
      .select(this.getSelectQuery())
      .single();

    if (error) {
      console.error('[todo] Failed to complete todo:', error);
      throw new DatabaseError(`ไม่สามารถทำเครื่องหมายงานได้: ${error.message}`);
    }

    return this.transformToTodoInfo(data);
  }

  /**
   * Mark todo as incomplete (reopen)
   */
  static async reopen(
    todoId: string,
    employeeId: string,
    employeeLevel: number
  ): Promise<TodoInfo> {
    const supabase = createServiceClient();

    // Check if todo exists and user has permission
    const existing = await this.getById(todoId, employeeId, employeeLevel);

    // Creator or assignee can reopen
    if (existing.creator.id !== employeeId && existing.assignee.id !== employeeId && employeeLevel < 2) {
      throw new AuthorizationError('ไม่มีสิทธิ์เปิดงานนี้อีกครั้ง');
    }

    if (!existing.is_completed) {
      throw new ValidationError('งานนี้ยังไม่เสร็จสิ้น');
    }

    const { data, error } = await supabase
      .from('main_todos')
      .update({
        is_completed: false,
        completed_at: null,
        notified_at: null, // Reset notification so it can notify again if still past deadline
        updated_at: new Date().toISOString(),
      })
      .eq('id', todoId)
      .select(this.getSelectQuery())
      .single();

    if (error) {
      console.error('[todo] Failed to reopen todo:', error);
      throw new DatabaseError(`ไม่สามารถเปิดงานอีกครั้งได้: ${error.message}`);
    }

    return this.transformToTodoInfo(data);
  }
}
