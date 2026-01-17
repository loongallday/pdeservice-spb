/**
 * Postback Event Handler - Handle ticket selection and other actions
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { LineApiService } from '../services/lineApiService.ts';
import type { LinePostbackEvent, PostbackData } from '../types.ts';

/**
 * Handle postback event
 */
export async function handlePostback(event: LinePostbackEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) {
    console.error('[Postback] No userId in event');
    return;
  }

  const replyToken = event.replyToken!;

  try {
    // Parse postback data
    const data = JSON.parse(event.postback.data) as PostbackData;

    switch (data.action) {
      case 'select_ticket':
        await handleSelectTicket(replyToken, userId, data);
        break;
      case 'cancel':
        await handleCancel(replyToken, data);
        break;
      case 'view_files':
        await handleViewFiles(replyToken, userId);
        break;
      case 'view_files_page':
        await handleViewFilesPage(replyToken, userId, data);
        break;
      case 'toggle_select':
        await handleToggleSelect(replyToken, userId, data);
        break;
      case 'delete_file':
        await handleDeleteFile(replyToken, userId, data);
        break;
      case 'select_all':
        await handleSelectAll(replyToken, userId);
        break;
      case 'clear_selection':
        await handleClearSelection(replyToken, userId);
        break;
      case 'delete_all':
        await handleDeleteAll(replyToken, userId);
        break;
      case 'view_linked_files':
        await handleViewLinkedFiles(replyToken, userId);
        break;
      case 'view_linked_files_page':
        await handleViewLinkedFilesPage(replyToken, userId, data);
        break;
      case 'unlink_file':
        await handleUnlinkFile(replyToken, userId, data);
        break;
      case 'submit_work':
        await handleSubmitWork(replyToken, userId, data);
        break;
      case 'view_ticket_files':
        await handleViewTicketFiles(replyToken, userId, data);
        break;
      case 'approve_file':
        await handleApproveFile(replyToken, userId, data);
        break;
      case 'reject_file':
        await handleRejectFile(replyToken, userId, data);
        break;
      case 'approver_files_page':
        await handleApproverFilesPage(replyToken, userId, data);
        break;
      default:
        console.log(`[Postback] Unknown action: ${data.action}`);
    }
  } catch (error) {
    console.error('[Postback] Error parsing data:', error);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
  }
}

/**
 * Handle ticket selection
 */
async function handleSelectTicket(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { fileId, ticketId, ticketCode } = data as {
    fileId: string;
    ticketId: string;
    ticketCode: string;
  };

  if (!fileId || !ticketId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลไฟล์หรือตั๋วงาน กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  try {
    // Verify file exists and is in pending status
    const { data: file, error: fileError } = await supabase
      .from('main_staged_files')
      .select('id, file_name, status')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      await LineApiService.reply(replyToken, [
        LineApiService.flex('ไม่พบไฟล์', LineApiService.createErrorBubble(
          'ไม่พบไฟล์',
          'ไฟล์นี้อาจถูกลบไปแล้ว กรุณาอัพโหลดใหม่'
        )),
      ]);
      return;
    }

    if (file.status !== 'pending') {
      await LineApiService.reply(replyToken, [
        LineApiService.flex('ไฟล์ถูกใช้แล้ว', LineApiService.createErrorBubble(
          'ไฟล์ถูกใช้แล้ว',
          'ไฟล์นี้ถูกเชื่อมต่อกับตั๋วอื่นไปแล้ว กรุณาอัพโหลดไฟล์ใหม่'
        )),
      ]);
      return;
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id, code')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      await LineApiService.reply(replyToken, [
        LineApiService.flex('ไม่พบตั๋ว', LineApiService.createErrorBubble(
          'ไม่พบตั๋วงาน',
          'ตั๋วงานนี้อาจถูกลบไปแล้ว'
        )),
      ]);
      return;
    }

    // Link file to ticket
    const { error: updateError } = await supabase
      .from('main_staged_files')
      .update({
        ticket_id: ticketId,
        status: 'linked',
      })
      .eq('id', fileId);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    // Send success message
    const successBubble = LineApiService.createLinkedSuccessBubble(
      ticketCode || ticket.code,
      file.file_name
    );

    await LineApiService.reply(replyToken, [
      LineApiService.flex('เชื่อมต่อสำเร็จ', successBubble),
    ]);

  } catch (error) {
    console.error('[Postback] Select ticket error:', error);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถเชื่อมต่อไฟล์กับตั๋วได้ กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
  }
}

/**
 * Handle cancel action
 */
async function handleCancel(
  replyToken: string,
  data: PostbackData
): Promise<void> {
  const { fileId } = data;

  if (fileId) {
    // Delete the staged file
    const supabase = createServiceClient();

    const { data: file } = await supabase
      .from('main_staged_files')
      .select('file_url, status')
      .eq('id', fileId)
      .single();

    if (file && file.status === 'pending') {
      // Delete from storage
      try {
        const fileUrl = file.file_url;
        if (fileUrl.includes('staging-files')) {
          const path = fileUrl.split('staging-files/')[1];
          if (path) {
            await supabase.storage.from('staging-files').remove([path]);
          }
        }
      } catch (err) {
        console.error('[Postback] Failed to delete from storage:', err);
      }

      // Delete from database
      await supabase
        .from('main_staged_files')
        .delete()
        .eq('id', fileId);
    }
  }

  await LineApiService.reply(replyToken, [
    LineApiService.text('ยกเลิกเรียบร้อยแล้ว'),
  ]);
}

/**
 * Handle view files action - show file carousel
 */
async function handleViewFiles(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Fetch all pending files (no limit)
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select('id, file_name, file_url, file_size, mime_type, created_at, metadata')
    .eq('employee_id', lineAccount.employee_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoFilesBubble()),
    ]);
    return;
  }

  const totalCount = pendingFiles.length;
  const selectedCount = pendingFiles.filter(f => f.metadata?.selected === true).length;

  // LINE carousel max = 12 bubbles (1 summary + 10 files + need space for navigation)
  const FILES_PER_PAGE = 10;
  const totalPages = Math.ceil(totalCount / FILES_PER_PAGE);
  const currentPage = 1; // Always start at page 1
  const startIdx = 0;
  const displayFiles = pendingFiles.slice(startIdx, startIdx + FILES_PER_PAGE);

  const carousel = LineApiService.createFileCarousel(
    displayFiles,
    totalCount,
    selectedCount,
    currentPage,
    totalPages
  );

  const statusText = selectedCount > 0
    ? `เลือก ${selectedCount}/${totalCount} ไฟล์\n\nพิมพ์รหัสตั๋วเพื่อเชื่อมต่อไฟล์ที่เลือก`
    : `มี ${totalCount} ไฟล์รอดำเนินการ\n\nพิมพ์รหัสตั๋วเพื่อเชื่อมต่อทุกไฟล์`;

  await LineApiService.reply(replyToken, [
    LineApiService.flex('รายการไฟล์', carousel),
    LineApiService.text(statusText),
  ]);
}

/**
 * Handle view files page action - show specific page of files
 */
async function handleViewFilesPage(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const requestedPage = (data as any).page as number;

  if (!requestedPage || requestedPage < 1) {
    await LineApiService.reply(replyToken, [
      LineApiService.text('หน้าไม่ถูกต้อง'),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Fetch all pending files (no limit)
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select('id, file_name, file_url, file_size, mime_type, created_at, metadata')
    .eq('employee_id', lineAccount.employee_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoFilesBubble()),
    ]);
    return;
  }

  const totalCount = pendingFiles.length;
  const selectedCount = pendingFiles.filter(f => f.metadata?.selected === true).length;

  const FILES_PER_PAGE = 10;
  const totalPages = Math.ceil(totalCount / FILES_PER_PAGE);

  // Validate page number
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIdx = (currentPage - 1) * FILES_PER_PAGE;
  const displayFiles = pendingFiles.slice(startIdx, startIdx + FILES_PER_PAGE);

  const carousel = LineApiService.createFileCarousel(
    displayFiles,
    totalCount,
    selectedCount,
    currentPage,
    totalPages
  );

  const statusText = selectedCount > 0
    ? `เลือก ${selectedCount}/${totalCount} ไฟล์\n\nพิมพ์รหัสตั๋วเพื่อเชื่อมต่อไฟล์ที่เลือก`
    : `มี ${totalCount} ไฟล์รอดำเนินการ\n\nพิมพ์รหัสตั๋วเพื่อเชื่อมต่อทุกไฟล์`;

  await LineApiService.reply(replyToken, [
    LineApiService.flex('รายการไฟล์', carousel),
    LineApiService.text(statusText),
  ]);
}

/**
 * Handle toggle select action - toggle file selection
 */
async function handleToggleSelect(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { fileId } = data;

  if (!fileId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลไฟล์'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Get the file
  const { data: file, error: fileError } = await supabase
    .from('main_staged_files')
    .select('id, file_name, metadata, employee_id, status')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบไฟล์', LineApiService.createErrorBubble(
        'ไม่พบไฟล์',
        'ไฟล์นี้อาจถูกลบไปแล้ว'
      )),
    ]);
    return;
  }

  // Verify ownership
  if (file.employee_id !== lineAccount.employee_id) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีสิทธิ์', LineApiService.createErrorBubble(
        'ไม่มีสิทธิ์',
        'คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้'
      )),
    ]);
    return;
  }

  // Verify status
  if (file.status !== 'pending') {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไฟล์ถูกใช้แล้ว', LineApiService.createErrorBubble(
        'ไฟล์ถูกใช้แล้ว',
        'ไฟล์นี้ถูกเชื่อมต่อกับตั๋วอื่นไปแล้ว'
      )),
    ]);
    return;
  }

  // Toggle selection
  const isCurrentlySelected = file.metadata?.selected === true;
  const newSelected = !isCurrentlySelected;

  await supabase
    .from('main_staged_files')
    .update({
      metadata: { ...file.metadata, selected: newSelected },
    })
    .eq('id', fileId);

  // Get updated file count
  const { data: allFiles } = await supabase
    .from('main_staged_files')
    .select('id, metadata')
    .eq('employee_id', lineAccount.employee_id)
    .eq('status', 'pending');

  const totalCount = allFiles?.length || 0;
  // Re-count selected after update
  const selectedCount = (allFiles || []).filter(f => {
    if (f.id === fileId) return newSelected;
    return f.metadata?.selected === true;
  }).length;

  await LineApiService.reply(replyToken, [
    LineApiService.flex('อัพเดตการเลือก', LineApiService.createSelectionUpdatedBubble(selectedCount, totalCount)),
  ]);
}

/**
 * Handle delete file action - delete single file
 */
async function handleDeleteFile(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { fileId } = data;

  if (!fileId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลไฟล์'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Get the file
  const { data: file, error: fileError } = await supabase
    .from('main_staged_files')
    .select('id, file_name, file_url, employee_id, status')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบไฟล์', LineApiService.createErrorBubble(
        'ไม่พบไฟล์',
        'ไฟล์นี้อาจถูกลบไปแล้ว'
      )),
    ]);
    return;
  }

  // Verify ownership
  if (file.employee_id !== lineAccount.employee_id) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีสิทธิ์', LineApiService.createErrorBubble(
        'ไม่มีสิทธิ์',
        'คุณไม่มีสิทธิ์ลบไฟล์นี้'
      )),
    ]);
    return;
  }

  // Verify status
  if (file.status !== 'pending') {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่สามารถลบได้', LineApiService.createErrorBubble(
        'ไม่สามารถลบได้',
        'ไฟล์นี้ถูกเชื่อมต่อกับตั๋วแล้ว ไม่สามารถลบได้'
      )),
    ]);
    return;
  }

  // Delete from storage
  try {
    if (file.file_url.includes('staging-files')) {
      const path = file.file_url.split('staging-files/')[1];
      if (path) {
        await supabase.storage.from('staging-files').remove([path]);
      }
    }
  } catch (err) {
    console.error('[Postback] Failed to delete from storage:', err);
  }

  // Delete from database
  await supabase
    .from('main_staged_files')
    .delete()
    .eq('id', fileId);

  await LineApiService.reply(replyToken, [
    LineApiService.flex('ลบสำเร็จ', LineApiService.createDeleteSuccessBubble(file.file_name)),
  ]);
}

/**
 * Handle select all action - select all pending files
 */
async function handleSelectAll(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Get pending files
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select('id, metadata')
    .eq('employee_id', lineAccount.employee_id)
    .eq('status', 'pending');

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoFilesBubble()),
    ]);
    return;
  }

  // Update all files to selected
  for (const file of pendingFiles) {
    await supabase
      .from('main_staged_files')
      .update({
        metadata: { ...file.metadata, selected: true },
      })
      .eq('id', file.id);
  }

  await LineApiService.reply(replyToken, [
    LineApiService.flex('เลือกทั้งหมด', LineApiService.createSelectionUpdatedBubble(pendingFiles.length, pendingFiles.length)),
  ]);
}

/**
 * Handle clear selection action - deselect all files
 */
async function handleClearSelection(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Get pending files
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select('id, metadata')
    .eq('employee_id', lineAccount.employee_id)
    .eq('status', 'pending');

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoFilesBubble()),
    ]);
    return;
  }

  // Update all files to deselected
  for (const file of pendingFiles) {
    await supabase
      .from('main_staged_files')
      .update({
        metadata: { ...file.metadata, selected: false },
      })
      .eq('id', file.id);
  }

  await LineApiService.reply(replyToken, [
    LineApiService.flex('ยกเลิกเลือก', LineApiService.createSelectionUpdatedBubble(0, pendingFiles.length)),
  ]);
}

/**
 * Handle delete all action - delete all pending files
 */
async function handleDeleteAll(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Get pending files
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select('id, file_url')
    .eq('employee_id', lineAccount.employee_id)
    .eq('status', 'pending');

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoFilesBubble()),
    ]);
    return;
  }

  // Delete from storage
  for (const file of pendingFiles) {
    try {
      if (file.file_url.includes('staging-files')) {
        const path = file.file_url.split('staging-files/')[1];
        if (path) {
          await supabase.storage.from('staging-files').remove([path]);
        }
      }
    } catch (err) {
      console.error('[Postback] Failed to delete from storage:', err);
    }
  }

  // Delete from database
  const fileIds = pendingFiles.map(f => f.id);
  await supabase
    .from('main_staged_files')
    .delete()
    .in('id', fileIds);

  await LineApiService.reply(replyToken, [
    LineApiService.flex('ลบสำเร็จ', LineApiService.createBulkDeleteSuccessBubble(pendingFiles.length)),
  ]);
}

/**
 * Handle view linked files action - show files that are linked/approved/rejected
 */
async function handleViewLinkedFiles(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Fetch linked/approved/rejected files
  const { data: linkedFiles } = await supabase
    .from('main_staged_files')
    .select(`
      id, file_name, file_url, file_size, mime_type, status,
      rejection_reason, created_at, approved_at,
      ticket:main_tickets(id, ticket_code)
    `)
    .eq('employee_id', lineAccount.employee_id)
    .in('status', ['linked', 'approved', 'rejected'])
    .order('created_at', { ascending: false });

  if (!linkedFiles || linkedFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoLinkedFilesBubble()),
    ]);
    return;
  }

  const totalCount = linkedFiles.length;

  // LINE carousel max = 12 bubbles (1 summary + 10 files + nav)
  const FILES_PER_PAGE = 10;
  const totalPages = Math.ceil(totalCount / FILES_PER_PAGE);
  const currentPage = 1;
  const startIdx = 0;
  const displayFiles = linkedFiles.slice(startIdx, startIdx + FILES_PER_PAGE);

  // Transform to LinkedFileForLine format
  const transformedFiles = displayFiles.map(f => ({
    id: f.id,
    file_name: f.file_name,
    file_url: f.file_url,
    file_size: f.file_size,
    mime_type: f.mime_type,
    status: f.status as 'linked' | 'approved' | 'rejected',
    rejection_reason: f.rejection_reason,
    created_at: f.created_at,
    approved_at: f.approved_at,
    ticket: f.ticket as { id: string; ticket_code: string } | null,
  }));

  const carousel = LineApiService.createLinkedFilesCarousel(
    transformedFiles,
    totalCount,
    currentPage,
    totalPages
  );

  // Count by status
  const linkedCount = linkedFiles.filter(f => f.status === 'linked').length;
  const approvedCount = linkedFiles.filter(f => f.status === 'approved').length;
  const rejectedCount = linkedFiles.filter(f => f.status === 'rejected').length;

  const statusText = `📊 สถานะไฟล์ทั้งหมด ${totalCount} ไฟล์\n` +
    `⏳ รออนุมัติ: ${linkedCount}\n` +
    `✅ อนุมัติแล้ว: ${approvedCount}\n` +
    `❌ ถูกปฏิเสธ: ${rejectedCount}`;

  await LineApiService.reply(replyToken, [
    LineApiService.flex('สถานะไฟล์', carousel),
    LineApiService.text(statusText),
  ]);
}

/**
 * Handle view linked files page action - show specific page
 */
async function handleViewLinkedFilesPage(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const requestedPage = (data as { page: number }).page;

  if (!requestedPage || requestedPage < 1) {
    await LineApiService.reply(replyToken, [
      LineApiService.text('หน้าไม่ถูกต้อง'),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Fetch linked/approved/rejected files
  const { data: linkedFiles } = await supabase
    .from('main_staged_files')
    .select(`
      id, file_name, file_url, file_size, mime_type, status,
      rejection_reason, created_at, approved_at,
      ticket:main_tickets(id, ticket_code)
    `)
    .eq('employee_id', lineAccount.employee_id)
    .in('status', ['linked', 'approved', 'rejected'])
    .order('created_at', { ascending: false });

  if (!linkedFiles || linkedFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoLinkedFilesBubble()),
    ]);
    return;
  }

  const totalCount = linkedFiles.length;
  const FILES_PER_PAGE = 10;
  const totalPages = Math.ceil(totalCount / FILES_PER_PAGE);

  // Validate page number
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIdx = (currentPage - 1) * FILES_PER_PAGE;
  const displayFiles = linkedFiles.slice(startIdx, startIdx + FILES_PER_PAGE);

  // Transform to LinkedFileForLine format
  const transformedFiles = displayFiles.map(f => ({
    id: f.id,
    file_name: f.file_name,
    file_url: f.file_url,
    file_size: f.file_size,
    mime_type: f.mime_type,
    status: f.status as 'linked' | 'approved' | 'rejected',
    rejection_reason: f.rejection_reason,
    created_at: f.created_at,
    approved_at: f.approved_at,
    ticket: f.ticket as { id: string; ticket_code: string } | null,
  }));

  const carousel = LineApiService.createLinkedFilesCarousel(
    transformedFiles,
    totalCount,
    currentPage,
    totalPages
  );

  await LineApiService.reply(replyToken, [
    LineApiService.flex('สถานะไฟล์', carousel),
  ]);
}

/**
 * Handle unlink file action - return file to pending status
 */
async function handleUnlinkFile(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { fileId } = data;

  if (!fileId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลไฟล์'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Get the file
  const { data: file, error: fileError } = await supabase
    .from('main_staged_files')
    .select('id, file_name, employee_id, status, ticket_id')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบไฟล์', LineApiService.createErrorBubble(
        'ไม่พบไฟล์',
        'ไฟล์นี้อาจถูกลบไปแล้ว'
      )),
    ]);
    return;
  }

  // Verify ownership
  if (file.employee_id !== lineAccount.employee_id) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีสิทธิ์', LineApiService.createErrorBubble(
        'ไม่มีสิทธิ์',
        'คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้'
      )),
    ]);
    return;
  }

  // Only allow unlink for 'linked' status (not approved or rejected)
  if (file.status !== 'linked') {
    const statusText = file.status === 'approved'
      ? 'ไฟล์นี้ได้รับการอนุมัติแล้ว ไม่สามารถยกเลิกได้'
      : file.status === 'rejected'
      ? 'ไฟล์นี้ถูกปฏิเสธแล้ว ไม่สามารถยกเลิกได้'
      : 'ไฟล์นี้ไม่ได้อยู่ในสถานะรออนุมัติ';

    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่สามารถยกเลิกได้', LineApiService.createErrorBubble(
        'ไม่สามารถยกเลิกได้',
        statusText
      )),
    ]);
    return;
  }

  // Unlink the file - return to pending status
  const { error: updateError } = await supabase
    .from('main_staged_files')
    .update({
      ticket_id: null,
      status: 'pending',
      metadata: {},
    })
    .eq('id', fileId);

  if (updateError) {
    console.error('[Postback] Unlink error:', updateError);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถยกเลิกการส่งไฟล์ได้ กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
    return;
  }

  await LineApiService.reply(replyToken, [
    LineApiService.flex('ยกเลิกสำเร็จ', LineApiService.createSuccessBubble(
      'ยกเลิกการส่งสำเร็จ',
      `ไฟล์ ${file.file_name} กลับมาอยู่ในรายการรอดำเนินการแล้ว\n\nพิมพ์รหัสตั๋วเพื่อส่งใหม่`
    )),
  ]);
}

/**
 * Handle submit work action - set active ticket for technician
 */
async function handleSubmitWork(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { ticketId, ticketCode } = data as { ticketId: string; ticketCode: string };

  if (!ticketId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลตั๋วงาน'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get employee LINE account
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('id, employee_id, active_ticket_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Set active ticket for this user
  await supabase
    .from('child_employee_line_accounts')
    .update({ active_ticket_id: ticketId })
    .eq('id', lineAccount.id);

  // Get count of files already submitted to this ticket
  const { count } = await supabase
    .from('main_staged_files')
    .select('*', { count: 'exact', head: true })
    .eq('ticket_id', ticketId)
    .eq('employee_id', lineAccount.employee_id);

  const existingCount = count || 0;
  const existingText = existingCount > 0 ? `\n(มี ${existingCount} ไฟล์ที่ส่งไปแล้ว)` : '';

  await LineApiService.reply(replyToken, [
    LineApiService.text(`📤 ส่งงาน ${ticketCode}${existingText}\n\nส่งรูปมาได้เลย รูปจะถูกเชื่อมกับตั๋วนี้โดยอัตโนมัติ\n\nพิมพ์ "เสร็จ" เมื่อส่งครบ`),
  ]);
}

/**
 * Handle view ticket files action - show files submitted to a specific ticket
 */
async function handleViewTicketFiles(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { ticketId, ticketCode } = data as { ticketId: string; ticketCode: string };

  if (!ticketId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลตั๋วงาน'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get employee
  const { data: lineAccount } = await supabase
    .from('child_employee_line_accounts')
    .select('employee_id')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (!lineAccount) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Fetch files for this ticket
  const { data: files } = await supabase
    .from('main_staged_files')
    .select('id, file_name, file_url, file_size, mime_type, status, created_at')
    .eq('ticket_id', ticketId)
    .eq('employee_id', lineAccount.employee_id)
    .order('created_at', { ascending: false });

  if (!files || files.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.text(`ไม่พบไฟล์ที่ส่งไปยัง ${ticketCode}`),
    ]);
    return;
  }

  // Create carousel with images
  const carousel = LineApiService.createTicketFilesCarousel(files, ticketCode);

  // Status summary
  const statusSummary = {
    linked: files.filter(f => f.status === 'linked').length,
    approved: files.filter(f => f.status === 'approved').length,
    rejected: files.filter(f => f.status === 'rejected').length,
  };

  const summaryText = [
    `📋 ${ticketCode} - ${files.length} ไฟล์`,
    statusSummary.linked > 0 ? `⏳ รออนุมัติ: ${statusSummary.linked}` : '',
    statusSummary.approved > 0 ? `✅ อนุมัติ: ${statusSummary.approved}` : '',
    statusSummary.rejected > 0 ? `❌ ปฏิเสธ: ${statusSummary.rejected}` : '',
  ].filter(Boolean).join('\n');

  await LineApiService.reply(replyToken, [
    LineApiService.flex(`ไฟล์ ${ticketCode}`, carousel),
    LineApiService.text(summaryText),
  ]);
}

/**
 * Get employee by LINE user ID with permission level
 */
async function getEmployeeWithPermission(userId: string): Promise<{
  employee_id: string;
  permission_level: number;
} | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('child_employee_line_accounts')
    .select(`
      employee_id,
      employee:main_employees(
        role:main_org_roles(level)
      )
    `)
    .eq('line_user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const emp = data.employee as { role: { level: number } | null } | null;
  const permissionLevel = emp?.role?.level ?? 0;

  return {
    employee_id: data.employee_id,
    permission_level: permissionLevel,
  };
}

/**
 * Handle approve file action - approver approves a pending file
 */
async function handleApproveFile(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { fileId } = data;

  if (!fileId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลไฟล์'
      )),
    ]);
    return;
  }

  const employee = await getEmployeeWithPermission(userId);

  if (!employee || employee.permission_level < 1) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีสิทธิ์', LineApiService.createErrorBubble(
        'ไม่มีสิทธิ์',
        'คุณไม่มีสิทธิ์อนุมัติไฟล์'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get the file
  const { data: file, error: fileError } = await supabase
    .from('main_staged_files')
    .select('id, file_name, status, ticket:main_tickets(ticket_code), employee:main_employees(name)')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบไฟล์', LineApiService.createErrorBubble(
        'ไม่พบไฟล์',
        'ไฟล์นี้อาจถูกลบไปแล้ว'
      )),
    ]);
    return;
  }

  if (file.status !== 'linked') {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่สามารถอนุมัติได้', LineApiService.createErrorBubble(
        'ไม่สามารถอนุมัติได้',
        file.status === 'approved' ? 'ไฟล์นี้ได้รับการอนุมัติแล้ว' : 'ไฟล์นี้ไม่ได้อยู่ในสถานะรออนุมัติ'
      )),
    ]);
    return;
  }

  // Approve the file
  const { error: updateError } = await supabase
    .from('main_staged_files')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: employee.employee_id,
    })
    .eq('id', fileId);

  if (updateError) {
    console.error('[Postback] Approve error:', updateError);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถอนุมัติไฟล์ได้ กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
    return;
  }

  const ticket = file.ticket as { ticket_code: string } | null;
  const emp = file.employee as { name: string } | null;

  await LineApiService.reply(replyToken, [
    LineApiService.flex('อนุมัติสำเร็จ', LineApiService.createSuccessBubble(
      '✅ อนุมัติสำเร็จ',
      `ไฟล์: ${file.file_name}\nตั๋ว: ${ticket?.ticket_code || '-'}\nผู้ส่ง: ${emp?.name || '-'}`
    )),
  ]);
}

/**
 * Handle reject file action - approver rejects a pending file
 */
async function handleRejectFile(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const { fileId } = data;

  if (!fileId) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ข้อมูลไม่ครบ', LineApiService.createErrorBubble(
        'ข้อมูลไม่ครบ',
        'ไม่พบข้อมูลไฟล์'
      )),
    ]);
    return;
  }

  const employee = await getEmployeeWithPermission(userId);

  if (!employee || employee.permission_level < 1) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีสิทธิ์', LineApiService.createErrorBubble(
        'ไม่มีสิทธิ์',
        'คุณไม่มีสิทธิ์ปฏิเสธไฟล์'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Get the file
  const { data: file, error: fileError } = await supabase
    .from('main_staged_files')
    .select('id, file_name, status, ticket:main_tickets(ticket_code), employee:main_employees(name)')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบไฟล์', LineApiService.createErrorBubble(
        'ไม่พบไฟล์',
        'ไฟล์นี้อาจถูกลบไปแล้ว'
      )),
    ]);
    return;
  }

  if (file.status !== 'linked') {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่สามารถปฏิเสธได้', LineApiService.createErrorBubble(
        'ไม่สามารถปฏิเสธได้',
        file.status === 'rejected' ? 'ไฟล์นี้ถูกปฏิเสธแล้ว' : 'ไฟล์นี้ไม่ได้อยู่ในสถานะรออนุมัติ'
      )),
    ]);
    return;
  }

  // Reject the file
  const { error: updateError } = await supabase
    .from('main_staged_files')
    .update({
      status: 'rejected',
      rejection_reason: 'ปฏิเสธโดยผู้อนุมัติ',
    })
    .eq('id', fileId);

  if (updateError) {
    console.error('[Postback] Reject error:', updateError);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถปฏิเสธไฟล์ได้ กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
    return;
  }

  const ticket = file.ticket as { ticket_code: string } | null;
  const emp = file.employee as { name: string } | null;

  await LineApiService.reply(replyToken, [
    LineApiService.flex('ปฏิเสธสำเร็จ', LineApiService.createSuccessBubble(
      '❌ ปฏิเสธสำเร็จ',
      `ไฟล์: ${file.file_name}\nตั๋ว: ${ticket?.ticket_code || '-'}\nผู้ส่ง: ${emp?.name || '-'}`
    )),
  ]);
}

/**
 * Handle approver files page action - show specific page of pending files for approver
 */
async function handleApproverFilesPage(
  replyToken: string,
  userId: string,
  data: PostbackData
): Promise<void> {
  const requestedPage = (data as { page: number }).page;

  if (!requestedPage || requestedPage < 1) {
    await LineApiService.reply(replyToken, [
      LineApiService.text('หน้าไม่ถูกต้อง'),
    ]);
    return;
  }

  const employee = await getEmployeeWithPermission(userId);

  if (!employee || employee.permission_level < 1) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีสิทธิ์', LineApiService.createErrorBubble(
        'ไม่มีสิทธิ์เข้าถึง',
        'คำสั่งนี้สำหรับผู้อนุมัติเท่านั้น'
      )),
    ]);
    return;
  }

  const supabase = createServiceClient();

  // Fetch ALL pending submissions from all employees
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select(`
      id, file_name, file_url, file_size, mime_type, status,
      created_at,
      employee:main_employees(name),
      ticket:main_tickets(id, ticket_code)
    `)
    .eq('status', 'linked')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createSuccessBubble(
        'ไม่มีไฟล์รออนุมัติ',
        'ไม่มีไฟล์ที่รอการอนุมัติในขณะนี้'
      )),
    ]);
    return;
  }

  const totalCount = pendingFiles.length;
  const FILES_PER_PAGE = 10;
  const totalPages = Math.ceil(totalCount / FILES_PER_PAGE);

  // Validate page number
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIdx = (currentPage - 1) * FILES_PER_PAGE;
  const displayFiles = pendingFiles.slice(startIdx, startIdx + FILES_PER_PAGE);

  const carousel = LineApiService.createApproverFilesCarousel(
    displayFiles as any,
    totalCount,
    currentPage,
    totalPages
  );

  await LineApiService.reply(replyToken, [
    LineApiService.flex('รออนุมัติ', carousel),
  ]);
}
