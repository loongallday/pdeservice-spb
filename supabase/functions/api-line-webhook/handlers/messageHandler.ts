/**
 * Message Event Handler - Handle incoming messages (image, file, text)
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { LineApiService } from '../services/lineApiService.ts';
import type { LineMessageEvent, LineImageMessage, LineFileMessage } from '../types.ts';

/**
 * Handle message event
 */
export async function handleMessage(event: LineMessageEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) {
    console.error('[Message] No userId in event');
    return;
  }

  const message = event.message;

  switch (message.type) {
    case 'image':
      await handleImageMessage(event, message);
      break;
    case 'file':
      await handleFileMessage(event, message);
      break;
    case 'video':
      await handleVideoMessage(event);
      break;
    case 'text':
      await handleTextMessage(event);
      break;
    default:
      // Ignore stickers and other message types
      console.log(`[Message] Ignoring message type: ${message.type}`);
  }
}

// Debounce window in seconds - if multiple files uploaded within this window, only show minimal reply
const UPLOAD_DEBOUNCE_SECONDS = 3;

/**
 * Handle image message
 */
async function handleImageMessage(
  event: LineMessageEvent,
  message: LineImageMessage
): Promise<void> {
  const userId = event.source.userId!;
  const replyToken = event.replyToken!;

  try {
    // Get employee from LINE user ID
    const employee = await getEmployeeByLineUserId(userId);
    if (!employee) {
      await LineApiService.reply(replyToken, [
        LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
          'ไม่พบบัญชี',
          'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ กรุณาติดต่อผู้ดูแลระบบ'
        )),
      ]);
      return;
    }

    const supabase = createServiceClient();

    // Check for recent uploads (debounce detection)
    const debounceTime = new Date(Date.now() - UPLOAD_DEBOUNCE_SECONDS * 1000).toISOString();
    const { data: recentFiles } = await supabase
      .from('main_staged_files')
      .select('id')
      .eq('employee_id', employee.employee_id)
      .eq('status', 'pending')
      .gte('created_at', debounceTime);

    const isPartOfBatch = recentFiles && recentFiles.length > 0;

    // Download image from LINE
    const { data, contentType } = await LineApiService.getMessageContent(message.id);

    // Determine file extension
    const ext = getExtensionFromMimeType(contentType);
    const fileName = `image_${Date.now()}${ext}`;

    // Upload to Supabase storage
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('staging-files')
      .upload(filePath, data, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('staging-files')
      .getPublicUrl(filePath);

    // Check if technician has active ticket context
    const isTechnician = employee.department_code === 'technical';
    const activeTicketId = employee.active_ticket_id;

    // Create staged file record - auto-link if technician has active ticket
    const insertData: Record<string, unknown> = {
      employee_id: employee.employee_id,
      file_url: urlData.publicUrl,
      file_name: fileName,
      file_size: data.byteLength,
      mime_type: contentType,
      source: 'line',
      metadata: { line_message_id: message.id },
    };

    if (isTechnician && activeTicketId) {
      insertData.ticket_id = activeTicketId;
      insertData.status = 'linked';
    }

    const { data: stagedFile, error: dbError } = await supabase
      .from('main_staged_files')
      .insert(insertData)
      .select('id, file_name')
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // If this is part of a batch upload, DON'T reply (silent receive)
    if (isPartOfBatch) {
      return;
    }

    // Technician with active ticket - show linked confirmation
    if (isTechnician && activeTicketId) {
      // Get ticket code for display
      const { data: ticket } = await supabase
        .from('main_tickets')
        .select('ticket_code')
        .eq('id', activeTicketId)
        .single();

      const ticketCode = ticket?.ticket_code || 'ตั๋ว';
      await LineApiService.reply(replyToken, [
        LineApiService.flex('ส่งงานสำเร็จ', LineApiService.createUploadSuccessBubble(fileName, urlData.publicUrl, contentType)),
        LineApiService.text(`✅ ส่งไฟล์ไปยัง ${ticketCode} แล้ว\n\nส่งรูปเพิ่มได้เลย หรือพิมพ์ "เสร็จ" เมื่อส่งครบ`),
      ]);
      return;
    }

    // Non-technician or no active ticket - normal flow
    const { count } = await supabase
      .from('main_staged_files')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', employee.employee_id)
      .eq('status', 'pending');

    const pendingCount = count || 1;

    const quickReplyItems = LineApiService.createQuickReplyItems(pendingCount, stagedFile.id);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('อัพโหลดสำเร็จ', LineApiService.createUploadSuccessBubble(fileName, urlData.publicUrl, contentType)),
      LineApiService.textWithQuickReply(
        'กรุณาส่งไฟล์ทั้งหมดก่อน แล้วพิมพ์รหัสตั๋ว เช่น PDE-904',
        quickReplyItems
      ),
    ]);

  } catch (error) {
    console.error('[Message] Image handling error:', error);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถอัพโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
  }
}

/**
 * Handle file message
 */
async function handleFileMessage(
  event: LineMessageEvent,
  message: LineFileMessage
): Promise<void> {
  const userId = event.source.userId!;
  const replyToken = event.replyToken!;

  try {
    const employee = await getEmployeeByLineUserId(userId);
    if (!employee) {
      await LineApiService.reply(replyToken, [
        LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
          'ไม่พบบัญชี',
          'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ กรุณาติดต่อผู้ดูแลระบบ'
        )),
      ]);
      return;
    }

    const supabase = createServiceClient();

    // Check for recent uploads (debounce detection)
    const debounceTime = new Date(Date.now() - UPLOAD_DEBOUNCE_SECONDS * 1000).toISOString();
    const { data: recentFiles } = await supabase
      .from('main_staged_files')
      .select('id')
      .eq('employee_id', employee.employee_id)
      .eq('status', 'pending')
      .gte('created_at', debounceTime);

    const isPartOfBatch = recentFiles && recentFiles.length > 0;

    // Download file from LINE
    const { data, contentType } = await LineApiService.getMessageContent(message.id);
    const fileName = message.fileName;

    // Upload to Supabase storage
    const filePath = `${userId}/${Date.now()}_${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('staging-files')
      .upload(filePath, data, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('staging-files')
      .getPublicUrl(filePath);

    // Create staged file record
    const { data: stagedFile, error: dbError } = await supabase
      .from('main_staged_files')
      .insert({
        employee_id: employee.employee_id,
        file_url: urlData.publicUrl,
        file_name: fileName,
        file_size: message.fileSize,
        mime_type: contentType,
        source: 'line',
        metadata: { line_message_id: message.id },
      })
      .select('id, file_name')
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // If this is part of a batch upload, DON'T reply (silent receive)
    if (isPartOfBatch) {
      // Silent - no reply to avoid spam during batch upload
      // User will see summary when they type "รายการ" or a ticket code
      return;
    }

    // Get pending files count (only for first file / single upload)
    const { count } = await supabase
      .from('main_staged_files')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', employee.employee_id)
      .eq('status', 'pending');

    const pendingCount = count || 1;

    // First file or single upload - send acknowledgment
    const quickReplyItems = LineApiService.createQuickReplyItems(pendingCount, stagedFile.id);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('อัพโหลดสำเร็จ', LineApiService.createUploadSuccessBubble(fileName, urlData.publicUrl, contentType)),
      LineApiService.textWithQuickReply(
        'กรุณาส่งไฟล์ทั้งหมดก่อน แล้วพิมพ์รหัสตั๋ว เช่น PDE-904',
        quickReplyItems
      ),
    ]);

  } catch (error) {
    console.error('[Message] File handling error:', error);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถอัพโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง'
      )),
    ]);
  }
}

/**
 * Handle video message
 */
async function handleVideoMessage(event: LineMessageEvent): Promise<void> {
  const replyToken = event.replyToken!;

  await LineApiService.reply(replyToken, [
    LineApiService.text('ขออภัย ระบบยังไม่รองรับการอัพโหลดวิดีโอ กรุณาส่งเป็นรูปภาพหรือไฟล์แทน'),
  ]);
}

/**
 * Handle text message - check if it's a ticket code or command
 */
async function handleTextMessage(event: LineMessageEvent): Promise<void> {
  const userId = event.source.userId!;
  const replyToken = event.replyToken!;
  const rawText = (event.message as { text: string }).text.trim();
  const text = rawText.toUpperCase();

  // Check if text looks like a ticket code (e.g., PDE-904) or just a number (e.g., 904)
  if (text.match(/^PDE-\d+$/)) {
    await handleTicketCodeInput(replyToken, userId, text);
    return;
  }

  // Allow typing just the number - automatically add PDE- prefix
  if (text.match(/^\d+$/) && text.length >= 1 && text.length <= 6) {
    const ticketCode = `PDE-${text}`;
    await handleTicketCodeInput(replyToken, userId, ticketCode);
    return;
  }

  // Check for file management commands
  const lowerText = rawText.toLowerCase();

  // Menu / Help command
  if (lowerText === 'เมนู' || lowerText === 'menu' || lowerText === 'help' || lowerText === '?') {
    await handleMenuCommand(replyToken, userId);
    return;
  }
  if (lowerText === 'รายการ' || lowerText === 'list') {
    await handleListFilesCommand(replyToken, userId);
    return;
  }
  if (lowerText === 'ลบทั้งหมด' || lowerText === 'delete all') {
    await handleDeleteAllCommand(replyToken, userId);
    return;
  }
  if (lowerText === 'เลือกทั้งหมด' || lowerText === 'select all') {
    await handleSelectAllCommand(replyToken, userId);
    return;
  }
  if (lowerText === 'ยกเลิกเลือก' || lowerText === 'clear') {
    await handleClearSelectionCommand(replyToken, userId);
    return;
  }
  if (lowerText === 'รออนุมัติ' || lowerText === 'สถานะ' || lowerText === 'status') {
    await handleLinkedFilesCommand(replyToken, userId);
    return;
  }
  if (lowerText === 'เชื่อมตั๋ว' || lowerText === 'link') {
    await handleLinkTicketPrompt(replyToken, userId);
    return;
  }
  // Check department for technician-specific routing
  const employeeForRouting = await getEmployeeByLineUserId(userId);
  const isTechnician = employeeForRouting?.department_code === 'technical';

  // "เสร็จ" command - clear active ticket context for technicians
  if (lowerText === 'เสร็จ' || lowerText === 'done') {
    if (employeeForRouting?.active_ticket_id) {
      await handleFinishSubmitCommand(replyToken, userId, employeeForRouting);
    } else {
      await LineApiService.reply(replyToken, [
        LineApiService.text('ไม่มีงานที่กำลังส่งอยู่'),
      ]);
    }
    return;
  }

  if (lowerText === 'วันนี้' || lowerText === 'today') {
    if (isTechnician) {
      // Technicians see only their assigned tickets
      await handleMyTicketsCommand(replyToken, userId);
    } else {
      await handleTodayTicketsCommand(replyToken, userId);
    }
    return;
  }
  if (lowerText === 'งานของฉัน' || lowerText === 'งานฉัน' || lowerText === 'my' || lowerText === 'mytasks') {
    await handleMyTicketsCommand(replyToken, userId);
    return;
  }

  // Check if user has pending files
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (employee) {
    const { data: pendingFiles } = await supabase
      .from('main_staged_files')
      .select('id, file_name')
      .eq('employee_id', employee.employee_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (pendingFiles && pendingFiles.length > 0) {
      const count = pendingFiles.length;
      const quickReplyItems = LineApiService.createQuickReplyItems(count, pendingFiles[0].id);
      await LineApiService.reply(replyToken, [
        LineApiService.textWithQuickReply(
          `คุณมี ${count} ไฟล์รอเชื่อมต่อ\n\nกรุณาพิมพ์รหัสตั๋ว เช่น PDE-904`,
          quickReplyItems
        ),
      ]);
      return;
    }
  }

  await LineApiService.reply(replyToken, [
    LineApiService.text('กรุณาส่งรูปภาพหรือไฟล์ที่ต้องการแนบกับตั๋วงาน'),
  ]);
}

/**
 * Handle ticket code input - link pending files to ticket
 * If files are selected, link only selected files
 * If no files selected, link all pending files
 */
async function handleTicketCodeInput(
  replyToken: string,
  userId: string,
  ticketCode: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get employee
  const employee = await getEmployeeByLineUserId(userId);
  if (!employee) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Find all pending files for this employee
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select('id, file_name, metadata')
    .eq('employee_id', employee.employee_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.text('ไม่พบไฟล์ที่รอเชื่อมต่อ\n\nกรุณาส่งรูปภาพหรือไฟล์ก่อน แล้วค่อยพิมพ์รหัสตั๋ว'),
    ]);
    return;
  }

  // Check if any files are selected
  const selectedFiles = pendingFiles.filter(f => f.metadata?.selected === true);
  const filesToLink = selectedFiles.length > 0 ? selectedFiles : pendingFiles;

  // Find ticket by code
  const { data: ticket } = await supabase
    .from('main_tickets')
    .select('id, ticket_code')
    .eq('ticket_code', ticketCode)
    .maybeSingle();

  if (!ticket) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบตั๋ว', LineApiService.createErrorBubble(
        'ไม่พบตั๋วงาน',
        `ไม่พบตั๋วรหัส ${ticketCode}\n\nกรุณาตรวจสอบรหัสตั๋วและลองใหม่`
      )),
    ]);
    return;
  }

  // Link files to ticket
  const fileIds = filesToLink.map(f => f.id);
  const { error: updateError } = await supabase
    .from('main_staged_files')
    .update({
      ticket_id: ticket.id,
      status: 'linked',
      metadata: {}, // Clear selection
    })
    .in('id', fileIds);

  if (updateError) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เกิดข้อผิดพลาด', LineApiService.createErrorBubble(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถเชื่อมต่อไฟล์กับตั๋วได้ กรุณาลองใหม่'
      )),
    ]);
    return;
  }

  // Success message
  const fileCount = filesToLink.length;
  if (fileCount === 1) {
    const successBubble = LineApiService.createLinkedSuccessBubble(ticket.ticket_code, filesToLink[0].file_name);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เชื่อมต่อสำเร็จ', successBubble),
    ]);
  } else {
    const successBubble = LineApiService.createBulkLinkedSuccessBubble(ticket.ticket_code, fileCount);
    await LineApiService.reply(replyToken, [
      LineApiService.flex('เชื่อมต่อสำเร็จ', successBubble),
    ]);
  }
}

/**
 * Get employee by LINE user ID with department info and permission level
 */
async function getEmployeeByLineUserId(lineUserId: string): Promise<{
  employee_id: string;
  display_name: string | null;
  department_code: string | null;
  permission_level: number;
  active_ticket_id: string | null;
  line_account_id: string;
} | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('child_employee_line_accounts')
    .select(`
      id,
      employee_id,
      display_name,
      active_ticket_id,
      employee:main_employees(
        role:main_org_roles(
          level,
          department:main_org_departments(code)
        )
      )
    `)
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const emp = data.employee as { role: { level: number; department: { code: string } | null } | null } | null;
  const departmentCode = emp?.role?.department?.code || null;
  const permissionLevel = emp?.role?.level ?? 0;

  return {
    employee_id: data.employee_id,
    display_name: data.display_name,
    department_code: departmentCode,
    permission_level: permissionLevel,
    active_ticket_id: data.active_ticket_id,
    line_account_id: data.id,
  };
}

/**
 * Get tickets assigned to employee
 */
async function getEmployeeTickets(employeeId: string): Promise<Array<{
  id: string;
  code: string;
  title: string;
  site_name: string;
  work_type_name: string;
  status_name: string;
  appointment_date?: string;
}>> {
  const supabase = createServiceClient();

  // Get ticket IDs assigned to employee
  const { data: assignments } = await supabase
    .from('jct_ticket_employees')
    .select('ticket_id')
    .eq('employee_id', employeeId)
    .limit(20);

  if (!assignments || assignments.length === 0) {
    return [];
  }

  const ticketIds = assignments.map(a => a.ticket_id);

  // Get ticket details
  const { data: tickets } = await supabase
    .from('main_tickets')
    .select(`
      id,
      code,
      title,
      status_code,
      site:main_sites(name),
      work_type:ref_work_types(name_th),
      status:ref_ticket_statuses(name_th)
    `)
    .in('id', ticketIds)
    .not('status_code', 'in', '("closed","cancelled","completed")')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (!tickets) {
    return [];
  }

  // Get appointments
  const resultTicketIds = tickets.map(t => t.id);
  const { data: appointments } = await supabase
    .from('main_appointments')
    .select('ticket_id, appointment_date')
    .in('ticket_id', resultTicketIds)
    .gte('appointment_date', new Date().toISOString().split('T')[0])
    .order('appointment_date', { ascending: true });

  const appointmentMap = new Map<string, string>();
  for (const apt of appointments || []) {
    if (!appointmentMap.has(apt.ticket_id)) {
      appointmentMap.set(apt.ticket_id, apt.appointment_date);
    }
  }

  return tickets.map(ticket => {
    const site = ticket.site as { name: string } | null;
    const workType = ticket.work_type as { name_th: string } | null;
    const status = ticket.status as { name_th: string } | null;

    return {
      id: ticket.id,
      code: ticket.code,
      title: ticket.title,
      site_name: site?.name || '-',
      work_type_name: workType?.name_th || '-',
      status_name: status?.name_th || '-',
      appointment_date: appointmentMap.get(ticket.id),
    };
  });
}

/**
 * Handle list files command - show file carousel
 */
async function handleListFilesCommand(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (!employee) {
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
    .eq('employee_id', employee.employee_id)
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
    displayFiles as any,
    totalCount,
    selectedCount,
    currentPage,
    totalPages
  );

  let statusText = selectedCount > 0
    ? `เลือก ${selectedCount}/${totalCount} ไฟล์\n\nพิมพ์รหัสตั๋วเพื่อเชื่อมต่อไฟล์ที่เลือก`
    : `มี ${totalCount} ไฟล์รอดำเนินการ\n\nพิมพ์รหัสตั๋วเพื่อเชื่อมต่อทุกไฟล์`;

  await LineApiService.reply(replyToken, [
    LineApiService.flex('รายการไฟล์', carousel),
    LineApiService.text(statusText),
  ]);
}

/**
 * Handle linked files command - approvers only can manage all submissions
 */
async function handleLinkedFilesCommand(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (!employee) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Check if user is an approver (permission level >= 1)
  const isApprover = employee.permission_level >= 1;

  if (!isApprover) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีสิทธิ์', LineApiService.createErrorBubble(
        'ไม่มีสิทธิ์เข้าถึง',
        'คำสั่งนี้สำหรับผู้อนุมัติเท่านั้น'
      )),
    ]);
    return;
  }

  // Approver: Fetch ALL pending submissions from all employees
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

  // LINE carousel max = 12 bubbles (1 summary + 10 files + pagination)
  const FILES_PER_PAGE = 10;
  const totalPages = Math.ceil(totalCount / FILES_PER_PAGE);
  const currentPage = 1;
  const startIdx = 0;
  const displayFiles = pendingFiles.slice(startIdx, startIdx + FILES_PER_PAGE);

  const carousel = LineApiService.createApproverFilesCarousel(
    displayFiles as any,
    totalCount,
    currentPage,
    totalPages
  );

  await LineApiService.reply(replyToken, [
    LineApiService.flex('รออนุมัติ', carousel),
    LineApiService.text(`มี ${totalCount} ไฟล์รออนุมัติ (7 วันล่าสุด)`),
  ]);
}

/**
 * Handle link ticket prompt - show pending files and prompt for ticket code
 */
async function handleLinkTicketPrompt(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (!employee) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  // Get pending files count
  const { data: pendingFiles } = await supabase
    .from('main_staged_files')
    .select('id, metadata')
    .eq('employee_id', employee.employee_id)
    .eq('status', 'pending');

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoFilesBubble()),
      LineApiService.text('ไม่มีไฟล์รอดำเนินการ\n\nกรุณาส่งรูปหรือไฟล์ก่อน แล้วค่อยพิมพ์รหัสตั๋ว'),
    ]);
    return;
  }

  const totalCount = pendingFiles.length;
  const selectedCount = pendingFiles.filter(f => f.metadata?.selected === true).length;

  let promptText: string;
  if (selectedCount > 0) {
    promptText = `คุณมี ${totalCount} ไฟล์รอดำเนินการ (เลือกไว้ ${selectedCount} ไฟล์)\n\n` +
      `📝 พิมพ์รหัสตั๋วเพื่อเชื่อมต่อไฟล์ที่เลือก\n` +
      `ตัวอย่าง: PDE-904 หรือ 904`;
  } else {
    promptText = `คุณมี ${totalCount} ไฟล์รอดำเนินการ\n\n` +
      `📝 พิมพ์รหัสตั๋วเพื่อเชื่อมต่อทุกไฟล์\n` +
      `ตัวอย่าง: PDE-904 หรือ 904`;
  }

  await LineApiService.reply(replyToken, [
    LineApiService.text(promptText),
  ]);
}

/**
 * Handle today tickets command - show all tickets for today grouped by teams
 * Query pattern matches /api-tickets/summaries for consistency
 */
async function handleTodayTicketsCommand(
  replyToken: string,
  _userId: string
): Promise<void> {
  // Format Thai date helper
  const formatThaiDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `วัน ${dayNames[date.getDay()]} ที่ ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear() + 543}`;
  };

  try {
    const supabase = createServiceClient();

    // Get today's date in Bangkok timezone
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

    // Step 1: Get approved appointments for today
    const { data: appointments, error: apptError } = await supabase
      .from('main_appointments')
      .select('id')
      .eq('appointment_date', today)
      .eq('is_approved', true);

    if (apptError || !appointments || appointments.length === 0) {
      const dateDisplay = formatThaiDate(today);
      await LineApiService.reply(replyToken, [
        LineApiService.text(`${dateDisplay} (ไม่มีงานคะ)`),
      ]);
      return;
    }

    const appointmentIds = appointments.map(a => a.id);

    // Step 2: Get tickets with those appointments
    const { data: tickets, error: ticketsError } = await supabase
      .from('main_tickets')
      .select(`
        ticket_code,
        site:main_sites(name, company:main_companies(name_th)),
        confirmed_technicians:jct_ticket_employees_cf(
          employee_id,
          employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(name)
        )
      `)
      .in('appointment_id', appointmentIds);

    if (ticketsError) {
      console.error('[Message] Error fetching tickets:', ticketsError);
      await LineApiService.reply(replyToken, [
        LineApiService.text('เกิดข้อผิดพลาดในการดึงข้อมูลตั๋ว'),
      ]);
      return;
    }

    const dateDisplay = formatThaiDate(today);

    if (!tickets || tickets.length === 0) {
      await LineApiService.reply(replyToken, [
        LineApiService.text(`${dateDisplay} (ไม่มีงานคะ)`),
      ]);
      return;
    }

    // Filter tickets that have confirmed technicians
    const ticketsWithConfirmations = tickets.filter(ticket => {
      const confirmed = ticket.confirmed_technicians as Array<Record<string, unknown>> | null;
      return confirmed && Array.isArray(confirmed) && confirmed.length > 0;
    });

    if (ticketsWithConfirmations.length === 0) {
      await LineApiService.reply(replyToken, [
        LineApiService.text(`${dateDisplay} (ยังไม่มีการยืนยันช่างคะ)`),
      ]);
      return;
    }

    // Group tickets by technician combinations
    const groupMap = new Map<string, {
      technicianDisplay: string;
      tickets: Array<{ ticketCode: string; summary: string }>;
    }>();

    for (const ticket of ticketsWithConfirmations) {
      const confirmed = ticket.confirmed_technicians as Array<{
        employee_id: string;
        employee: { name: string } | null;
      }>;

      const technicianIds = confirmed.map(cf => cf.employee_id).sort().join(',');
      const technicianNames = confirmed
        .map(cf => cf.employee?.name)
        .filter((n): n is string => !!n)
        .join(' + ');

      if (!groupMap.has(technicianIds)) {
        groupMap.set(technicianIds, { technicianDisplay: technicianNames, tickets: [] });
      }

      // Company name (site name) or just site name if no company
      const site = ticket.site as { name?: string; company?: { name_th?: string } } | null;
      const siteName = site?.name || '';
      const companyName = site?.company?.name_th || '';
      let displayName = siteName;
      if (companyName && siteName) {
        displayName = `${companyName} (${siteName})`;
      } else if (companyName) {
        displayName = companyName;
      }

      groupMap.get(technicianIds)!.tickets.push({
        ticketCode: ticket.ticket_code,
        summary: displayName,
      });
    }

    // Build teams array
    const teams = Array.from(groupMap.values()).map((group, index) => ({
      teamNumber: index + 1,
      technicianDisplay: group.technicianDisplay,
      tickets: group.tickets,
    }));

    const totalTickets = ticketsWithConfirmations.length;
    const bubble = LineApiService.createTeamTicketsBubble(teams, dateDisplay, totalTickets);

    await LineApiService.reply(replyToken, [
      LineApiService.flex('ตั๋ววันนี้', bubble),
    ]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Message] Error fetching today tickets:', errorMessage, error);
    await LineApiService.reply(replyToken, [
      LineApiService.text('เกิดข้อผิดพลาดในการดึงข้อมูลตั๋ว'),
    ]);
  }
}

/**
 * Handle my tickets command - show tickets assigned to current user for today
 */
async function handleMyTicketsCommand(
  replyToken: string,
  userId: string
): Promise<void> {
  console.log('[MyTickets] Starting for userId:', userId);
  try {
    const supabase = createServiceClient();
    const employee = await getEmployeeByLineUserId(userId);

    if (!employee) {
      console.log('[MyTickets] Employee not found');
      await LineApiService.reply(replyToken, [
        LineApiService.text('บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'),
      ]);
      return;
    }

    console.log('[MyTickets] Employee found:', employee.employee_id);

    // Get today's date in Bangkok timezone
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const isTechnician = employee.department_code === 'technical';

    // Simple query - just get ticket codes
    const { data: ticketAssignments, error } = await supabase
      .from('jct_ticket_employees_cf')
      .select('ticket_id')
      .eq('employee_id', employee.employee_id)
      .eq('date', today);

    console.log('[MyTickets] Query result - error:', error?.message ?? 'none', 'count:', ticketAssignments?.length ?? 0);

    if (error) {
      await LineApiService.reply(replyToken, [
        LineApiService.text(`เกิดข้อผิดพลาด: ${error.message}`),
      ]);
      return;
    }

    const ticketIds = (ticketAssignments || []).map(a => a.ticket_id);

    if (ticketIds.length === 0) {
      await LineApiService.reply(replyToken, [
        LineApiService.text(`📅 ${today}\n\nไม่มีงานที่ได้รับมอบหมายวันนี้`),
      ]);
      return;
    }

    // Get ticket details separately
    const { data: tickets, error: ticketsError } = await supabase
      .from('main_tickets')
      .select(`
        id,
        ticket_code,
        details,
        site:main_sites(name),
        work_type:ref_ticket_work_types(name),
        appointment:main_appointments(appointment_time_start, appointment_time_end)
      `)
      .in('id', ticketIds);

    console.log('[MyTickets] Tickets query - error:', ticketsError?.message ?? 'none', 'count:', tickets?.length ?? 0);

    if (ticketsError || !tickets) {
      await LineApiService.reply(replyToken, [
        LineApiService.text(`เกิดข้อผิดพลาดในการดึงข้อมูลตั๋ว: ${ticketsError?.message ?? 'unknown'}`),
      ]);
      return;
    }

    // Build simple ticket list
    const ticketList = tickets.map(ticket => {
      const site = ticket.site as { name: string } | null;
      const workType = ticket.work_type as { name: string } | null;
      const appointment = ticket.appointment as { appointment_time_start: string | null; appointment_time_end: string | null } | null;

      let appointmentTime = '';
      if (appointment?.appointment_time_start) {
        const startTime = appointment.appointment_time_start.substring(0, 5);
        const endTime = appointment.appointment_time_end?.substring(0, 5);
        appointmentTime = endTime ? `${startTime}-${endTime}` : startTime;
      }

      return {
        ticketId: ticket.id,
        ticketCode: ticket.ticket_code,
        siteName: site?.name || '-',
        workType: workType?.name || '-',
        details: ticket.details || '',
        appointmentTime,
        contactName: '',
        contactPhone: '',
        submittedCount: 0,
        location: '',
        mapUrl: '',
        merchandise: '',
        attachmentCount: 0,
      };
    });

    const displayDate = new Date().toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    console.log('[MyTickets] Creating bubble with', ticketList.length, 'tickets');
    const bubble = LineApiService.createMyTicketsBubble(ticketList, displayDate, employee.display_name || 'ไม่ระบุชื่อ', isTechnician);

    console.log('[MyTickets] Sending reply...');
    await LineApiService.reply(replyToken, [
      LineApiService.flex('งานของฉัน', bubble),
    ]);
    console.log('[MyTickets] Done');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MyTickets] Error:', errorMessage);
    await LineApiService.reply(replyToken, [
      LineApiService.text(`เกิดข้อผิดพลาด: ${errorMessage}`),
    ]);
  }
}

/**
 * Handle delete all command - delete all pending files
 */
async function handleDeleteAllCommand(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (!employee) {
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
    .eq('employee_id', employee.employee_id)
    .eq('status', 'pending');

  if (!pendingFiles || pendingFiles.length === 0) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่มีไฟล์', LineApiService.createNoFilesBubble()),
    ]);
    return;
  }

  // Delete files from storage
  for (const file of pendingFiles) {
    try {
      if (file.file_url.includes('staging-files')) {
        const path = file.file_url.split('staging-files/')[1];
        if (path) {
          await supabase.storage.from('staging-files').remove([path]);
        }
      }
    } catch (err) {
      console.error('[Message] Failed to delete file from storage:', err);
    }
  }

  // Delete records
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
 * Handle select all command - select all pending files
 */
async function handleSelectAllCommand(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (!employee) {
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
    .eq('employee_id', employee.employee_id)
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
 * Handle clear selection command - deselect all files
 */
async function handleClearSelectionCommand(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (!employee) {
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
    .eq('employee_id', employee.employee_id)
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
 * Handle finish submit command - clear active ticket context
 */
async function handleFinishSubmitCommand(
  replyToken: string,
  _userId: string,
  employee: { line_account_id: string; active_ticket_id: string | null }
): Promise<void> {
  const supabase = createServiceClient();

  // Get count of files submitted to this ticket
  const { count } = await supabase
    .from('main_staged_files')
    .select('*', { count: 'exact', head: true })
    .eq('ticket_id', employee.active_ticket_id)
    .eq('status', 'linked');

  // Get ticket code
  const { data: ticket } = await supabase
    .from('main_tickets')
    .select('ticket_code')
    .eq('id', employee.active_ticket_id)
    .single();

  // Clear active ticket
  await supabase
    .from('child_employee_line_accounts')
    .update({ active_ticket_id: null })
    .eq('id', employee.line_account_id);

  const ticketCode = ticket?.ticket_code || 'ตั๋ว';
  await LineApiService.reply(replyToken, [
    LineApiService.text(`✅ ส่งงาน ${ticketCode} เสร็จสิ้น\n\nส่งไปแล้ว ${count || 0} ไฟล์ รอการอนุมัติ\n\nพิมพ์ "งานของฉัน" เพื่อดูงานอื่น`),
  ]);
}

/**
 * Handle menu command - show available commands based on role
 */
async function handleMenuCommand(
  replyToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  const employee = await getEmployeeByLineUserId(userId);

  if (!employee) {
    await LineApiService.reply(replyToken, [
      LineApiService.flex('ไม่พบบัญชี', LineApiService.createErrorBubble(
        'ไม่พบบัญชี',
        'บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ'
      )),
    ]);
    return;
  }

  const isTechnician = employee.department_code === 'technical';

  await LineApiService.reply(replyToken, [
    LineApiService.flex('เมนู', LineApiService.createMenuBubble(isTechnician)),
  ]);
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return mimeToExt[mimeType] || '.bin';
}
