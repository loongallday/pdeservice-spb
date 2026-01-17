/**
 * Follow Event Handler - Handle when user adds bot as friend
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { LineApiService } from '../services/lineApiService.ts';
import type { LineFollowEvent } from '../types.ts';

/**
 * Handle follow event (user adds bot as friend)
 */
export async function handleFollow(event: LineFollowEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) {
    console.error('[Follow] No userId in event');
    return;
  }

  const replyToken = event.replyToken!;

  try {
    // Get user profile
    const profile = await LineApiService.getProfile(userId);

    // Check if LINE account is already linked
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from('child_employee_line_accounts')
      .select('id, employee_id, display_name')
      .eq('line_user_id', userId)
      .maybeSingle();

    if (existing) {
      // Update display name and profile if changed
      await supabase
        .from('child_employee_line_accounts')
        .update({
          display_name: profile.displayName,
          profile_picture_url: profile.pictureUrl || null,
        })
        .eq('id', existing.id);

      // Get employee name
      const { data: employee } = await supabase
        .from('main_employees')
        .select('name')
        .eq('id', existing.employee_id)
        .single();

      await LineApiService.reply(replyToken, [
        LineApiService.text(`ยินดีต้อนรับกลับ ${employee?.name || profile.displayName}! 👋\n\nคุณสามารถส่งรูปภาพหรือไฟล์เพื่อแนบกับตั๋วงานได้เลย`),
      ]);
    } else {
      // New user - send welcome message
      const welcomeBubble = LineApiService.createWelcomeBubble();

      await LineApiService.reply(replyToken, [
        LineApiService.flex('ยินดีต้อนรับ', welcomeBubble),
      ]);

      // Log for admin to link account
      console.log(`[Follow] New LINE user: ${userId} (${profile.displayName})`);
    }

  } catch (error) {
    console.error('[Follow] Error:', error);
    await LineApiService.reply(replyToken, [
      LineApiService.text('ยินดีต้อนรับ! 👋\n\nกรุณาติดต่อผู้ดูแลระบบเพื่อเชื่อมต่อบัญชี'),
    ]);
  }
}

/**
 * Handle unfollow event (user blocks or removes bot)
 */
export async function handleUnfollow(userId: string): Promise<void> {
  console.log(`[Unfollow] User ${userId} unfollowed the bot`);
  // We don't delete the LINE account mapping - user might re-follow later
}
