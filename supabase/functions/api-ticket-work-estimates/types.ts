/**
 * Ticket Work Estimates Types
 */

export interface WorkEstimate {
  id: string;
  ticket_id: string;
  estimated_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkEstimateWithTicket extends WorkEstimate {
  ticket_code: string | null;
  site_name: string | null;
  work_type_name: string | null;
}

export interface CreateWorkEstimateRequest {
  ticket_id: string;
  estimated_minutes: number;
  notes?: string;
}

export interface UpdateWorkEstimateRequest {
  estimated_minutes?: number;
  notes?: string;
}

export interface BulkCreateRequest {
  estimates: CreateWorkEstimateRequest[];
}

export interface BulkCreateResponse {
  created: number;
  updated: number;
  errors: Array<{
    ticket_id: string;
    error: string;
  }>;
}
