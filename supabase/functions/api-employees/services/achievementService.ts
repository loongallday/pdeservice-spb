/**
 * Achievement service - Business logic for employee achievement tracking
 * Temporary gamification add-on
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

interface AchievementGoal {
  id: string;
  name: string;
  description: string | null;
  action_type: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  target_count: number;
  reward_type: string;
  reward_description: string | null;
  is_active: boolean;
}

interface EmployeeAchievement {
  id: string;
  employee_id: string;
  goal_id: string;
  period_start: string;
  period_end: string;
  current_count: number;
  status: 'in_progress' | 'completed';
  completed_at: string | null;
}

interface EmployeeCoupon {
  id: string;
  employee_id: string;
  achievement_id: string | null;
  coupon_type: string;
  coupon_description: string | null;
  status: 'available' | 'redeemed' | 'expired';
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
}

interface ProgressItem {
  goal: {
    id: string;
    name: string;
    description: string | null;
    period_type: string;
    target_count: number;
    reward_type: string;
    reward_description: string | null;
  };
  current_count: number;
  target_count: number;
  period_start: string;
  period_end: string;
  status: string;
  percentage: number;
}

/**
 * Calculate period boundaries based on period_type
 */
function calculatePeriod(periodType: 'daily' | 'weekly' | 'monthly'): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (periodType === 'daily') {
    // Today: 00:00:00 to 23:59:59
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (periodType === 'weekly') {
    // Monday to Sunday of current week
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  } else {
    // First to last day of current month
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Format as YYYY-MM-DD
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

export class AchievementService {
  /**
   * Track an action and update achievement progress
   * Called when employee performs an action (e.g., creates a ticket)
   */
  static async trackAction(
    employeeId: string,
    actionType: string
  ): Promise<{ goals_updated: number; coupons_earned: number; progress: ProgressItem[] }> {
    const supabase = createServiceClient();

    // Step 1: Get all active goals matching the action type
    const { data: goals, error: goalsError } = await supabase
      .from('addon_achievement_goals')
      .select('*')
      .eq('action_type', actionType)
      .eq('is_active', true);

    if (goalsError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลเป้าหมายได้: ${goalsError.message}`);
    }

    if (!goals || goals.length === 0) {
      return { goals_updated: 0, coupons_earned: 0, progress: [] };
    }

    let goalsUpdated = 0;
    let couponsEarned = 0;
    const progress: ProgressItem[] = [];

    // Step 2: For each goal, update progress
    for (const goal of goals as AchievementGoal[]) {
      const period = calculatePeriod(goal.period_type);

      // Count actual tickets from main_tickets for this period
      const { count: ticketCount, error: countError } = await supabase
        .from('main_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', employeeId)
        .gte('created_at', `${period.start}T00:00:00`)
        .lte('created_at', `${period.end}T23:59:59`);

      if (countError) {
        console.error(`Error counting tickets: ${countError.message}`);
        continue;
      }

      const currentCount = ticketCount || 0;

      // Get or create achievement record for this period
      const { data: existingAchievement, error: fetchError } = await supabase
        .from('addon_employee_achievements')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('goal_id', goal.id)
        .eq('period_start', period.start)
        .maybeSingle();

      if (fetchError) {
        console.error(`Error fetching achievement: ${fetchError.message}`);
        continue;
      }

      let achievement: EmployeeAchievement;

      if (existingAchievement) {
        // Update existing achievement
        const wasCompleted = existingAchievement.status === 'completed';
        const nowCompleted = currentCount >= goal.target_count;

        const { data: updated, error: updateError } = await supabase
          .from('addon_employee_achievements')
          .update({
            current_count: currentCount,
            status: nowCompleted ? 'completed' : 'in_progress',
            completed_at: nowCompleted && !wasCompleted ? new Date().toISOString() : existingAchievement.completed_at,
          })
          .eq('id', existingAchievement.id)
          .select()
          .single();

        if (updateError) {
          console.error(`Error updating achievement: ${updateError.message}`);
          continue;
        }

        achievement = updated as EmployeeAchievement;

        // Issue coupon if just completed (wasn't completed before, now is)
        if (!wasCompleted && nowCompleted) {
          const couponIssued = await this.issueCoupon(employeeId, achievement.id, goal);
          if (couponIssued) couponsEarned++;
        }
      } else {
        // Create new achievement record
        const isCompleted = currentCount >= goal.target_count;

        const { data: created, error: createError } = await supabase
          .from('addon_employee_achievements')
          .insert({
            employee_id: employeeId,
            goal_id: goal.id,
            period_start: period.start,
            period_end: period.end,
            current_count: currentCount,
            status: isCompleted ? 'completed' : 'in_progress',
            completed_at: isCompleted ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating achievement: ${createError.message}`);
          continue;
        }

        achievement = created as EmployeeAchievement;

        // Issue coupon if completed on creation
        if (isCompleted) {
          const couponIssued = await this.issueCoupon(employeeId, achievement.id, goal);
          if (couponIssued) couponsEarned++;
        }
      }

      goalsUpdated++;

      // Add to progress response
      progress.push({
        goal: {
          id: goal.id,
          name: goal.name,
          description: goal.description,
          period_type: goal.period_type,
          target_count: goal.target_count,
          reward_type: goal.reward_type,
          reward_description: goal.reward_description,
        },
        current_count: achievement.current_count,
        target_count: goal.target_count,
        period_start: achievement.period_start,
        period_end: achievement.period_end,
        status: achievement.status,
        percentage: Math.min(100, Math.round((achievement.current_count / goal.target_count) * 100)),
      });
    }

    return { goals_updated: goalsUpdated, coupons_earned: couponsEarned, progress };
  }

  /**
   * Issue a coupon for completing a goal
   */
  private static async issueCoupon(
    employeeId: string,
    achievementId: string,
    goal: AchievementGoal
  ): Promise<boolean> {
    const supabase = createServiceClient();

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase.from('addon_employee_coupons').insert({
      employee_id: employeeId,
      achievement_id: achievementId,
      coupon_type: goal.reward_type,
      coupon_description: goal.reward_description,
      status: 'available',
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error(`Error issuing coupon: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Get current employee's achievement progress for all active goals
   */
  static async getProgress(employeeId: string): Promise<ProgressItem[]> {
    const supabase = createServiceClient();

    // Get all active goals
    const { data: goals, error: goalsError } = await supabase
      .from('addon_achievement_goals')
      .select('*')
      .eq('is_active', true)
      .order('period_type');

    if (goalsError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลเป้าหมายได้: ${goalsError.message}`);
    }

    if (!goals || goals.length === 0) {
      return [];
    }

    const progress: ProgressItem[] = [];

    for (const goal of goals as AchievementGoal[]) {
      const period = calculatePeriod(goal.period_type);

      // Get existing achievement for this period
      const { data: achievement, error: achievementError } = await supabase
        .from('addon_employee_achievements')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('goal_id', goal.id)
        .eq('period_start', period.start)
        .maybeSingle();

      if (achievementError) {
        console.error(`Error fetching achievement: ${achievementError.message}`);
        continue;
      }

      // If no achievement record exists, count tickets directly
      let currentCount = 0;
      let status = 'in_progress';

      if (achievement) {
        currentCount = (achievement as EmployeeAchievement).current_count;
        status = (achievement as EmployeeAchievement).status;
      } else {
        // Count actual tickets for accurate progress display
        const { count: ticketCount, error: countError } = await supabase
          .from('main_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', employeeId)
          .gte('created_at', `${period.start}T00:00:00`)
          .lte('created_at', `${period.end}T23:59:59`);

        if (!countError) {
          currentCount = ticketCount || 0;
        }
      }

      progress.push({
        goal: {
          id: goal.id,
          name: goal.name,
          description: goal.description,
          period_type: goal.period_type,
          target_count: goal.target_count,
          reward_type: goal.reward_type,
          reward_description: goal.reward_description,
        },
        current_count: currentCount,
        target_count: goal.target_count,
        period_start: period.start,
        period_end: period.end,
        status: status,
        percentage: Math.min(100, Math.round((currentCount / goal.target_count) * 100)),
      });
    }

    return progress;
  }

  /**
   * Get employee's coupons
   */
  static async getCoupons(
    employeeId: string,
    status?: 'available' | 'redeemed' | 'expired'
  ): Promise<EmployeeCoupon[]> {
    const supabase = createServiceClient();

    let query = supabase
      .from('addon_employee_coupons')
      .select('*')
      .eq('employee_id', employeeId)
      .order('issued_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลคูปองได้: ${error.message}`);
    }

    // Also check and update expired coupons
    const now = new Date();
    const coupons = (data || []) as EmployeeCoupon[];

    // Update any expired coupons (status is 'available' but expires_at has passed)
    const expiredIds = coupons
      .filter((c) => c.status === 'available' && new Date(c.expires_at) < now)
      .map((c) => c.id);

    if (expiredIds.length > 0) {
      await supabase
        .from('addon_employee_coupons')
        .update({ status: 'expired' })
        .in('id', expiredIds);

      // Update local data
      coupons.forEach((c) => {
        if (expiredIds.includes(c.id)) {
          c.status = 'expired';
        }
      });
    }

    // If filtering by status, re-filter after expiration updates
    if (status) {
      return coupons.filter((c) => c.status === status);
    }

    return coupons;
  }
}

