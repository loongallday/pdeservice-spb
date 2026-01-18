/**
 * Route Optimization Job Service
 * Handles async job creation and status polling
 */

import { createServiceClient } from '../../_shared/supabase.ts';

export interface OptimizationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  request_payload: Record<string, unknown>;
  result_payload: Record<string, unknown> | null;
  error_message: string | null;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Create a new optimization job
 */
export async function createJob(
  employeeId: string,
  requestPayload: Record<string, unknown>
): Promise<string> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_route_optimization_jobs')
    .insert({
      status: 'pending',
      request_payload: requestPayload,
      created_by: employeeId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create job:', error);
    throw new Error('ไม่สามารถสร้างงานคำนวณเส้นทางได้');
  }

  return data.id;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<OptimizationJob | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_route_optimization_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Failed to get job:', error);
    throw new Error('ไม่สามารถดึงข้อมูลงานได้');
  }

  return data;
}

/**
 * Update job status to processing
 */
export async function markJobProcessing(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('main_route_optimization_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to mark job processing:', error);
  }
}

/**
 * Mark job as completed with result
 */
export async function markJobCompleted(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('main_route_optimization_jobs')
    .update({
      status: 'completed',
      result_payload: result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to mark job completed:', error);
  }
}

/**
 * Mark job as failed with error message
 */
export async function markJobFailed(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('main_route_optimization_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to mark job failed:', error);
  }
}

/**
 * Get pending jobs (for background processing)
 */
export async function getPendingJobs(limit: number = 5): Promise<OptimizationJob[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_route_optimization_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to get pending jobs:', error);
    return [];
  }

  return data || [];
}
