/**
 * Types for Staging API
 */

// Staged file status
export type StagedFileStatus = 'pending' | 'linked' | 'approved' | 'rejected' | 'expired';

// Database row type
export interface StagedFileRow {
  id: string;
  employee_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  ticket_id: string | null;
  status: StagedFileStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  result_comment_id: string | null;
  expires_at: string;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Staged file with relations
export interface StagedFile extends StagedFileRow {
  employee?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
  ticket?: {
    id: string;
    ticket_code: string;
    work_type?: {
      code: string;
      name: string;
    } | null;
  } | null;
  approver?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
}

// LINE account mapping
export interface LineAccountRow {
  id: string;
  employee_id: string;
  line_user_id: string;
  display_name: string | null;
  profile_picture_url: string | null;
  linked_at: string;
  created_at: string;
  updated_at: string;
}

export interface LineAccount extends LineAccountRow {
  employee?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
}

// Input types
export interface CreateStagedFileInput {
  line_user_id: string; // Used to find employee
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface LinkFileInput {
  ticket_id: string;
}

export interface ApproveFileInput {
  comment_content?: string; // Optional custom comment
}

export interface RejectFileInput {
  reason: string;
}

export interface BulkApproveInput {
  file_ids: string[];
  comment_content?: string;
}

export interface CreateLineAccountInput {
  employee_id: string;
  line_user_id: string;
  display_name?: string;
  profile_picture_url?: string;
}

// Query options
export interface StagedFileQueryOptions {
  status?: StagedFileStatus | StagedFileStatus[];
  employee_id?: string;
  ticket_id?: string;
  page?: number;
  limit?: number;
}

// Carousel ticket for LINE
export interface CarouselTicket {
  id: string;
  ticket_code: string;
  site_name: string;
  work_type_name: string;
  status_name: string;
  appointment_date?: string;
}

// Grouped files response
export interface TicketGroup {
  ticket: {
    id: string;
    ticket_code: string;
    work_type?: {
      code: string;
      name: string;
    } | null;
  } | null;
  files: StagedFile[];
  file_count: number;
}

export interface GroupedFilesResponse {
  groups: TicketGroup[];
  summary: {
    total_files: number;
    total_groups: number;
    by_status: {
      pending: number;
      linked: number;
      approved: number;
      rejected: number;
      expired: number;
    };
  };
}

export interface GroupedFileQueryOptions {
  status?: StagedFileStatus | StagedFileStatus[];
  employee_id?: string;
}
