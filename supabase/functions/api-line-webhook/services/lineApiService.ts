/**
 * LINE API Service - Send messages and interact with LINE Platform
 */

import type {
  SendMessage,
  LineProfile,
  FlexBubble,
  FlexBox,
  FlexButton,
  FlexText,
  FlexCarousel,
  FlexComponent,
  QuickReplyItem,
  TextMessageWithQuickReply,
  StagedFileForLine,
  LinkedFileForLine,
} from '../types.ts';

const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_DATA_API_BASE = 'https://api-data.line.me/v2/bot';

function getAccessToken(): string {
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
  }
  return token;
}

export class LineApiService {
  /**
   * Send reply message (responds to a webhook event)
   */
  static async reply(replyToken: string, messages: SendMessage[]): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/message/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: messages.slice(0, 5), // Max 5 messages
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[LINE API] Reply failed:', error);
      throw new Error(`LINE reply failed: ${response.status}`);
    }
  }

  /**
   * Send push message (proactive message to user)
   */
  static async push(userId: string, messages: SendMessage[]): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: messages.slice(0, 5),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[LINE API] Push failed:', error);
      throw new Error(`LINE push failed: ${response.status}`);
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(userId: string): Promise<LineProfile> {
    const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Get profile failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get message content (image, video, audio, file)
   * Returns the binary content
   */
  static async getMessageContent(messageId: string): Promise<{
    data: ArrayBuffer;
    contentType: string;
  }> {
    const response = await fetch(`${LINE_DATA_API_BASE}/message/${messageId}/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Get content failed: ${response.status}`);
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const data = await response.arrayBuffer();

    return { data, contentType };
  }

  /**
   * Show loading animation
   */
  static async showLoading(chatId: string, loadingSeconds: number = 5): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/chat/loading/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        chatId,
        loadingSeconds: Math.min(loadingSeconds, 60),
      }),
    });

    if (!response.ok) {
      console.error('[LINE API] Show loading failed');
    }
  }

  /**
   * Create a text message
   */
  static text(text: string): SendMessage {
    return { type: 'text', text };
  }

  /**
   * Create a flex message
   */
  static flex(altText: string, contents: FlexBubble | FlexCarousel): SendMessage {
    return { type: 'flex', altText, contents };
  }

  /**
   * Create ticket selection carousel
   */
  static createTicketCarousel(tickets: Array<{
    id: string;
    code: string;
    title: string;
    site_name: string;
    work_type_name: string;
    status_name: string;
    appointment_date?: string;
  }>, fileId: string): FlexCarousel {
    const bubbles: FlexBubble[] = tickets.map(ticket => ({
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: ticket.code,
            weight: 'bold',
            size: 'md',
            color: '#1DB446',
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#F5F5F5',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: ticket.title,
            weight: 'bold',
            size: 'sm',
            wrap: true,
            maxLines: 2,
          },
          {
            type: 'text',
            text: ticket.site_name,
            size: 'xs',
            color: '#666666',
            margin: 'md',
            wrap: true,
            maxLines: 1,
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: ticket.work_type_name,
                size: 'xs',
                color: '#FFFFFF',
                align: 'center',
              },
            ],
            backgroundColor: '#06C755',
            cornerRadius: '4px',
            paddingAll: '4px',
            margin: 'md',
          },
          ...(ticket.appointment_date ? [{
            type: 'text' as const,
            text: `📅 ${ticket.appointment_date}`,
            size: 'xs' as const,
            color: '#888888',
            margin: 'md' as const,
          }] : []),
        ],
        paddingAll: '12px',
        spacing: 'sm',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'เลือกตั๋วนี้',
              data: JSON.stringify({
                action: 'select_ticket',
                fileId,
                ticketId: ticket.id,
                ticketCode: ticket.code,
              }),
              displayText: `เลือกตั๋ว ${ticket.code}`,
            },
            style: 'primary',
            height: 'sm',
            color: '#1DB446',
          },
        ],
        paddingAll: '12px',
      },
    }));

    return {
      type: 'carousel',
      contents: bubbles,
    };
  }

  /**
   * Create upload success message
   */
  static createUploadSuccessBubble(fileName: string, fileUrl?: string, mimeType?: string): FlexBubble {
    const isImage = mimeType?.startsWith('image/');

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      styles: {
        header: {
          backgroundColor: '#27AE60',
        },
      },
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'อัพโหลดสำเร็จ',
                weight: 'bold',
                size: 'lg',
                color: '#FFFFFF',
              },
              {
                type: 'text',
                text: 'ไฟล์พร้อมเชื่อมต่อกับตั๋วงาน',
                size: 'xs',
                color: '#FFFFFF',
                margin: 'sm',
              },
            ],
            flex: 1,
          },
          {
            type: 'text',
            text: '✓',
            size: '3xl',
            color: '#FFFFFF',
            align: 'center',
            gravity: 'center',
            flex: 0,
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: isImage ? '🖼️' : '📎',
                    size: 'xxl',
                    align: 'center',
                  },
                ],
                width: '50px',
                height: '50px',
                backgroundColor: '#F0F0F0',
                cornerRadius: '8px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: fileName,
                    weight: 'bold',
                    size: 'sm',
                    wrap: true,
                    maxLines: 2,
                    color: '#333333',
                  },
                  {
                    type: 'text',
                    text: isImage ? 'รูปภาพ' : 'ไฟล์เอกสาร',
                    size: 'xs',
                    color: '#888888',
                    margin: 'sm',
                  },
                ],
                flex: 1,
                margin: 'lg',
              },
            ],
            alignItems: 'center',
          },
          {
            type: 'separator',
            margin: 'xl',
            color: '#E0E0E0',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '💡',
                size: 'sm',
                flex: 0,
              },
              {
                type: 'text',
                text: 'พิมพ์รหัสตั๋ว เช่น PDE-904 เพื่อเชื่อมต่อไฟล์',
                size: 'xs',
                color: '#666666',
                wrap: true,
                flex: 1,
                margin: 'sm',
              },
            ],
            margin: 'xl',
          },
        ],
        paddingAll: '20px',
      },
    };

    // Add image preview if it's an image and URL is provided
    if (isImage && fileUrl) {
      bubble.hero = {
        type: 'image',
        url: fileUrl,
        size: 'full',
        aspectRatio: '16:9',
        aspectMode: 'cover',
      };
    }

    return bubble;
  }

  /**
   * Create file linked success message
   */
  static createLinkedSuccessBubble(ticketCode: string, fileName: string): FlexBubble {
    return {
      type: 'bubble',
      size: 'mega',
      styles: {
        header: {
          backgroundColor: '#2E86AB',
        },
      },
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'เชื่อมต่อสำเร็จ',
                weight: 'bold',
                size: 'lg',
                color: '#FFFFFF',
              },
              {
                type: 'text',
                text: 'ไฟล์ถูกเชื่อมต่อกับตั๋วแล้ว',
                size: 'xs',
                color: '#FFFFFF',
                margin: 'sm',
              },
            ],
            flex: 1,
          },
          {
            type: 'text',
            text: '🔗',
            size: '3xl',
            align: 'center',
            gravity: 'center',
            flex: 0,
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '📎',
                    size: 'xl',
                    align: 'center',
                  },
                ],
                width: '40px',
                height: '40px',
                backgroundColor: '#E8F4FD',
                cornerRadius: '20px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'ไฟล์',
                    size: 'xs',
                    color: '#888888',
                  },
                  {
                    type: 'text',
                    text: fileName,
                    size: 'sm',
                    weight: 'bold',
                    color: '#333333',
                    wrap: true,
                    maxLines: 2,
                  },
                ],
                flex: 1,
                margin: 'lg',
              },
            ],
            alignItems: 'center',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '🎫',
                    size: 'xl',
                    align: 'center',
                  },
                ],
                width: '40px',
                height: '40px',
                backgroundColor: '#E8F4FD',
                cornerRadius: '20px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'ตั๋วงาน',
                    size: 'xs',
                    color: '#888888',
                  },
                  {
                    type: 'text',
                    text: ticketCode,
                    size: 'md',
                    weight: 'bold',
                    color: '#2E86AB',
                  },
                ],
                flex: 1,
                margin: 'lg',
              },
            ],
            alignItems: 'center',
            margin: 'lg',
          },
          {
            type: 'separator',
            margin: 'xl',
            color: '#E0E0E0',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '⏳',
                    size: 'sm',
                    align: 'center',
                  },
                ],
                width: '24px',
                height: '24px',
                backgroundColor: '#FFF3CD',
                cornerRadius: '12px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'text',
                text: 'รอผู้อนุมัติตรวจสอบและอนุมัติ',
                size: 'xs',
                color: '#856404',
                margin: 'md',
                gravity: 'center',
              },
            ],
            margin: 'xl',
            alignItems: 'center',
          },
        ],
        paddingAll: '20px',
      },
    };
  }

  /**
   * Create error message bubble
   */
  static createErrorBubble(title: string, message: string): FlexBubble {
    return {
      type: 'bubble',
      size: 'kilo',
      styles: {
        body: {
          backgroundColor: '#FFF5F5',
        },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '✕',
                    size: 'lg',
                    color: '#FFFFFF',
                    align: 'center',
                    weight: 'bold',
                  },
                ],
                width: '36px',
                height: '36px',
                backgroundColor: '#E53935',
                cornerRadius: '18px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'text',
                text: title,
                weight: 'bold',
                size: 'md',
                color: '#C62828',
                margin: 'lg',
                gravity: 'center',
                flex: 1,
              },
            ],
            alignItems: 'center',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: message,
                size: 'sm',
                color: '#5D4037',
                wrap: true,
              },
            ],
            backgroundColor: '#FFFFFF',
            cornerRadius: '8px',
            paddingAll: '12px',
            margin: 'lg',
          },
        ],
        paddingAll: '16px',
      },
    };
  }

  /**
   * Create success message bubble
   */
  static createSuccessBubble(title: string, message: string): FlexBubble {
    return {
      type: 'bubble',
      size: 'kilo',
      styles: {
        body: {
          backgroundColor: '#F1F8E9',
        },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '✓',
                    size: 'lg',
                    color: '#FFFFFF',
                    align: 'center',
                    weight: 'bold',
                  },
                ],
                width: '36px',
                height: '36px',
                backgroundColor: '#43A047',
                cornerRadius: '18px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'text',
                text: title,
                weight: 'bold',
                size: 'md',
                color: '#2E7D32',
                margin: 'lg',
                gravity: 'center',
                flex: 1,
              },
            ],
            alignItems: 'center',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: message,
                size: 'sm',
                color: '#33691E',
                wrap: true,
              },
            ],
            backgroundColor: '#FFFFFF',
            cornerRadius: '8px',
            paddingAll: '12px',
            margin: 'lg',
          },
        ],
        paddingAll: '16px',
      },
    };
  }

  /**
   * Create welcome message for new followers
   */
  static createWelcomeBubble(): FlexBubble {
    return {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '👋 ยินดีต้อนรับ',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: 'ระบบส่งไฟล์งาน PDE Service',
            size: 'md',
            color: '#333333',
            margin: 'md',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'text',
            text: 'วิธีใช้งาน:',
            weight: 'bold',
            size: 'sm',
            color: '#333333',
            margin: 'lg',
          },
          {
            type: 'text',
            text: '1. ส่งรูปภาพหรือไฟล์ที่ต้องการแนบ',
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'text',
            text: '2. เลือกตั๋วงานที่ต้องการแนบไฟล์',
            size: 'sm',
            color: '#666666',
            margin: 'sm',
            wrap: true,
          },
          {
            type: 'text',
            text: '3. รอผู้อนุมัติตรวจสอบและอนุมัติ',
            size: 'sm',
            color: '#666666',
            margin: 'sm',
            wrap: true,
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'text',
            text: '⚠️ หากยังไม่ได้เชื่อมต่อบัญชี กรุณาติดต่อผู้ดูแลระบบ',
            size: 'xs',
            color: '#888888',
            margin: 'lg',
            wrap: true,
          },
        ],
        paddingAll: '20px',
      },
    };
  }

  /**
   * Create text message with quick reply buttons
   */
  static textWithQuickReply(text: string, quickReplyItems: QuickReplyItem[]): TextMessageWithQuickReply {
    return {
      type: 'text',
      text,
      quickReply: {
        items: quickReplyItems,
      },
    };
  }

  /**
   * Create quick reply items for file management
   */
  static createQuickReplyItems(pendingCount: number, latestFileId?: string): QuickReplyItem[] {
    const items: QuickReplyItem[] = [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '💬 พิมพ์รหัสตั๋ว',
          text: 'พิมพ์รหัสตั๋ว เช่น PDE-904',
        },
      },
      {
        type: 'action',
        action: {
          type: 'postback',
          label: `📋 ดูรายการ (${pendingCount})`,
          data: JSON.stringify({ action: 'view_files' }),
          displayText: 'รายการไฟล์',
        },
      },
    ];

    // Add delete latest button if there's a file
    if (latestFileId) {
      items.push({
        type: 'action',
        action: {
          type: 'postback',
          label: '🗑️ ลบไฟล์ล่าสุด',
          data: JSON.stringify({ action: 'delete_file', fileId: latestFileId }),
          displayText: 'ลบไฟล์ล่าสุด',
        },
      });
    }

    return items;
  }

  /**
   * Create file carousel for viewing pending files
   * @param files - Files to display in carousel (max 10 for LINE limit with pagination)
   * @param totalCount - Optional total count of all files (for when displaying subset)
   * @param selectedCount - Optional selected count of all files (for when displaying subset)
   * @param currentPage - Current page number (1-based)
   * @param totalPages - Total number of pages
   */
  static createFileCarousel(
    files: StagedFileForLine[],
    totalCount?: number,
    selectedCount?: number,
    currentPage: number = 1,
    totalPages: number = 1
  ): FlexCarousel {
    const displaySelectedCount = selectedCount ?? files.filter(f => f.metadata?.selected === true).length;
    const displayTotalCount = totalCount ?? files.length;
    const hasPrevPage = currentPage > 1;
    const hasNextPage = currentPage < totalPages;

    // Add summary bubble at the beginning
    const summaryBubble: FlexBubble = {
      type: 'bubble',
      size: 'kilo',
      styles: {
        header: {
          backgroundColor: '#5C6BC0',
        },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 รายการไฟล์',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: totalPages > 1
              ? `${displayTotalCount} ไฟล์ (หน้า ${currentPage}/${totalPages})`
              : `${displayTotalCount} ไฟล์รอดำเนินการ`,
            size: 'xs',
            color: '#FFFFFF',
            margin: 'sm',
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${displaySelectedCount}`,
                    size: 'xxl',
                    weight: 'bold',
                    color: displaySelectedCount > 0 ? '#4CAF50' : '#9E9E9E',
                    align: 'center',
                  },
                  {
                    type: 'text',
                    text: 'เลือกแล้ว',
                    size: 'xs',
                    color: '#888888',
                    align: 'center',
                  },
                ],
                flex: 1,
              },
              {
                type: 'separator',
                color: '#E0E0E0',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${displayTotalCount}`,
                    size: 'xxl',
                    weight: 'bold',
                    color: '#5C6BC0',
                    align: 'center',
                  },
                  {
                    type: 'text',
                    text: 'ทั้งหมด',
                    size: 'xs',
                    color: '#888888',
                    align: 'center',
                  },
                ],
                flex: 1,
              },
            ],
            paddingAll: '12px',
          },
          {
            type: 'separator',
            margin: 'lg',
            color: '#E0E0E0',
          },
          {
            type: 'text',
            text: '💡 ปัดซ้ายเพื่อดูไฟล์',
            size: 'xs',
            color: '#888888',
            margin: 'lg',
            align: 'center',
          },
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          // Pagination buttons (if multiple pages)
          ...(totalPages > 1 ? [{
            type: 'box' as const,
            layout: 'horizontal' as const,
            spacing: 'sm',
            contents: [
              {
                type: 'button' as const,
                action: {
                  type: 'postback' as const,
                  label: '◀ ก่อนหน้า',
                  data: JSON.stringify({ action: 'view_files_page', page: currentPage - 1 }),
                  displayText: `หน้า ${currentPage - 1}`,
                },
                style: 'secondary' as const,
                height: 'sm' as const,
                flex: 1,
                ...(hasPrevPage ? {} : { color: '#CCCCCC' }),
              },
              {
                type: 'button' as const,
                action: {
                  type: 'postback' as const,
                  label: 'ถัดไป ▶',
                  data: JSON.stringify({ action: 'view_files_page', page: currentPage + 1 }),
                  displayText: `หน้า ${currentPage + 1}`,
                },
                style: 'secondary' as const,
                height: 'sm' as const,
                flex: 1,
                ...(hasNextPage ? {} : { color: '#CCCCCC' }),
              },
            ],
          }] : []),
          {
            type: 'button',
            action: {
              type: 'postback',
              label: displaySelectedCount === displayTotalCount ? '✕ ยกเลิกทั้งหมด' : '✓ เลือกทั้งหมด',
              data: JSON.stringify({ action: displaySelectedCount === displayTotalCount ? 'clear_selection' : 'select_all' }),
              displayText: displaySelectedCount === displayTotalCount ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด',
            },
            style: 'primary',
            color: displaySelectedCount === displayTotalCount ? '#9E9E9E' : '#4CAF50',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '🗑️ ลบทั้งหมด',
              data: JSON.stringify({ action: 'delete_all' }),
              displayText: 'ลบทั้งหมด',
            },
            style: 'secondary',
            height: 'sm',
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#FAFAFA',
      },
    };

    // File bubbles
    const fileBubbles = files.map(file => this.createFileBubble(file, file.file_url));

    return {
      type: 'carousel',
      contents: [summaryBubble, ...fileBubbles],
    };
  }

  /**
   * Create single file bubble with select/delete actions
   */
  static createFileBubble(file: StagedFileForLine, fileUrl?: string): FlexBubble {
    const isSelected = file.metadata?.selected === true;
    const isImage = file.mime_type?.startsWith('image/');

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          // File info row
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: isImage ? '🖼️' : '📄',
                    size: 'xl',
                    align: 'center',
                  },
                ],
                width: '44px',
                height: '44px',
                backgroundColor: isSelected ? '#E8F5E9' : '#F5F5F5',
                cornerRadius: '8px',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: isSelected ? '2px' : '0px',
                borderColor: '#4CAF50',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: file.file_name,
                    weight: 'bold',
                    size: 'sm',
                    wrap: true,
                    maxLines: 2,
                    color: '#333333',
                  },
                  {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                      {
                        type: 'text',
                        text: this.formatFileSize(file.file_size),
                        size: 'xs',
                        color: '#888888',
                      },
                      {
                        type: 'text',
                        text: '•',
                        size: 'xs',
                        color: '#CCCCCC',
                        margin: 'sm',
                      },
                      {
                        type: 'text',
                        text: this.formatRelativeTime(file.created_at),
                        size: 'xs',
                        color: '#888888',
                        margin: 'sm',
                      },
                    ],
                    margin: 'sm',
                  },
                ],
                flex: 1,
                margin: 'lg',
              },
            ],
            alignItems: 'center',
          },
          // Selection status badge
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: isSelected ? '✓ เลือกแล้ว' : '○ ยังไม่ได้เลือก',
                    size: 'xs',
                    color: isSelected ? '#FFFFFF' : '#666666',
                    weight: isSelected ? 'bold' : 'regular',
                  },
                ],
                backgroundColor: isSelected ? '#4CAF50' : '#E0E0E0',
                cornerRadius: '12px',
                paddingAll: '6px',
                paddingStart: '12px',
                paddingEnd: '12px',
              },
            ],
            margin: 'lg',
          },
        ],
        paddingAll: '16px',
        backgroundColor: isSelected ? '#FAFFF9' : '#FFFFFF',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: isSelected ? '✕ ยกเลิก' : '✓ เลือก',
              data: JSON.stringify({ action: 'toggle_select', fileId: file.id }),
              displayText: isSelected ? 'ยกเลิกเลือก' : 'เลือกไฟล์',
            },
            style: 'primary',
            color: isSelected ? '#9E9E9E' : '#4CAF50',
            height: 'sm',
            flex: 1,
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '🗑️ ลบ',
              data: JSON.stringify({ action: 'delete_file', fileId: file.id }),
              displayText: 'ลบไฟล์',
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#FAFAFA',
      },
    };

    // Add image preview as hero if it's an image
    if (isImage && fileUrl) {
      bubble.hero = {
        type: 'image',
        url: fileUrl,
        size: 'full',
        aspectRatio: '4:3',
        aspectMode: 'cover',
      };
    }

    return bubble;
  }

  /**
   * Create bulk linked success message
   */
  static createBulkLinkedSuccessBubble(ticketCode: string, fileCount: number): FlexBubble {
    return {
      type: 'bubble',
      size: 'mega',
      styles: {
        header: {
          backgroundColor: '#2E86AB',
        },
      },
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'เชื่อมต่อสำเร็จ',
                weight: 'bold',
                size: 'lg',
                color: '#FFFFFF',
              },
              {
                type: 'text',
                text: `${fileCount} ไฟล์ถูกเชื่อมต่อกับตั๋วแล้ว`,
                size: 'xs',
                color: '#FFFFFF',
                margin: 'sm',
              },
            ],
            flex: 1,
          },
          {
            type: 'text',
            text: '🔗',
            size: '3xl',
            align: 'center',
            gravity: 'center',
            flex: 0,
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '📁',
                    size: 'xl',
                    align: 'center',
                  },
                ],
                width: '48px',
                height: '48px',
                backgroundColor: '#E3F2FD',
                cornerRadius: '24px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${fileCount} ไฟล์`,
                    size: 'xl',
                    weight: 'bold',
                    color: '#2E86AB',
                  },
                  {
                    type: 'text',
                    text: `→ ตั๋ว ${ticketCode}`,
                    size: 'sm',
                    color: '#666666',
                    margin: 'sm',
                  },
                ],
                flex: 1,
                margin: 'xl',
                justifyContent: 'center',
              },
            ],
            alignItems: 'center',
          },
          {
            type: 'separator',
            margin: 'xl',
            color: '#E0E0E0',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '⏳',
                    size: 'sm',
                    align: 'center',
                  },
                ],
                width: '24px',
                height: '24px',
                backgroundColor: '#FFF3CD',
                cornerRadius: '12px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'text',
                text: 'รอผู้อนุมัติตรวจสอบและอนุมัติ',
                size: 'xs',
                color: '#856404',
                margin: 'md',
                gravity: 'center',
              },
            ],
            margin: 'xl',
            alignItems: 'center',
          },
        ],
        paddingAll: '20px',
      },
    };
  }

  /**
   * Create no files message bubble
   */
  static createNoFilesBubble(): FlexBubble {
    return {
      type: 'bubble',
      size: 'kilo',
      styles: {
        body: {
          backgroundColor: '#F5F5F5',
        },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📂',
                size: '3xl',
                align: 'center',
              },
            ],
            paddingAll: '20px',
          },
          {
            type: 'text',
            text: 'ไม่มีไฟล์รอดำเนินการ',
            weight: 'bold',
            size: 'md',
            color: '#666666',
            align: 'center',
          },
          {
            type: 'text',
            text: 'ส่งรูปภาพหรือไฟล์เพื่อเริ่มต้น',
            size: 'sm',
            color: '#888888',
            margin: 'md',
            align: 'center',
            wrap: true,
          },
        ],
        paddingAll: '20px',
      },
    };
  }

  /**
   * Create delete success message bubble
   */
  static createDeleteSuccessBubble(fileName: string): FlexBubble {
    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🗑️ ลบไฟล์สำเร็จ',
            weight: 'bold',
            size: 'md',
            color: '#666666',
          },
          {
            type: 'text',
            text: fileName,
            size: 'sm',
            color: '#888888',
            margin: 'md',
            wrap: true,
          },
        ],
        paddingAll: '16px',
      },
    };
  }

  /**
   * Create bulk delete success message bubble
   */
  static createBulkDeleteSuccessBubble(count: number): FlexBubble {
    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🗑️ ลบไฟล์สำเร็จ',
            weight: 'bold',
            size: 'md',
            color: '#666666',
          },
          {
            type: 'text',
            text: `ลบ ${count} ไฟล์เรียบร้อยแล้ว`,
            size: 'sm',
            color: '#888888',
            margin: 'md',
            wrap: true,
          },
        ],
        paddingAll: '16px',
      },
    };
  }

  /**
   * Create selection updated message bubble
   */
  static createSelectionUpdatedBubble(selectedCount: number, totalCount: number): FlexBubble {
    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '☑ อัพเดตการเลือก',
            weight: 'bold',
            size: 'md',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: `เลือก ${selectedCount}/${totalCount} ไฟล์`,
            size: 'sm',
            color: '#666666',
            margin: 'md',
          },
          {
            type: 'text',
            text: 'พิมพ์รหัสตั๋วเพื่อเชื่อมต่อไฟล์ที่เลือก',
            size: 'xs',
            color: '#888888',
            margin: 'md',
            wrap: true,
          },
        ],
        paddingAll: '16px',
      },
    };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number | null): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Format relative time for display
   */
  static formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return date.toLocaleDateString('th-TH');
  }

  /**
   * Create today's tickets bubble
   */
  static createTodayTicketsBubble(
    tickets: Array<{ ticketCode: string; displayName: string }>,
    date: string
  ): FlexBubble {
    // Create ticket rows as simple text
    const ticketContents: FlexComponent[] = tickets.length > 0
      ? tickets.map((ticket, index) => ({
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: ticket.ticketCode,
              size: 'sm',
              weight: 'bold',
              color: '#5C6BC0',
              flex: 0,
            },
            {
              type: 'text',
              text: ticket.displayName,
              size: 'sm',
              color: '#666666',
              wrap: true,
              flex: 1,
              margin: 'md',
            },
          ],
          margin: index === 0 ? 'none' : 'md',
        } as FlexBox))
      : [{
          type: 'text',
          text: 'ไม่มีตั๋วสำหรับวันนี้',
          size: 'sm',
          color: '#888888',
          align: 'center',
        } as FlexText];

    return {
      type: 'bubble',
      size: 'mega',
      styles: {
        header: {
          backgroundColor: '#5C6BC0',
        },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📅 ตั๋ววันนี้ (${tickets.length})`,
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: date,
            size: 'xs',
            color: '#E8EAF6',
            margin: 'sm',
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: ticketContents,
        paddingAll: '16px',
        spacing: 'sm',
      },
    };
  }

  /**
   * Create team-grouped tickets bubble for today
   */
  static createTeamTicketsBubble(
    teams: Array<{
      teamNumber: number;
      technicianDisplay: string;
      tickets: Array<{ ticketCode: string; summary: string }>;
    }>,
    date: string,
    totalTickets: number
  ): FlexBubble {
    // Build team contents
    const teamContents: FlexComponent[] = teams.length > 0
      ? teams.flatMap((team, teamIndex) => {
          const teamHeader: FlexBox = {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${team.teamNumber}`,
                    size: 'sm',
                    weight: 'bold',
                    color: '#FFFFFF',
                    align: 'center',
                  },
                ],
                width: '24px',
                height: '24px',
                backgroundColor: '#5C6BC0',
                cornerRadius: '12px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'text',
                text: team.technicianDisplay || 'ไม่ระบุ',
                size: 'sm',
                weight: 'bold',
                color: '#5C6BC0',
                flex: 1,
                margin: 'md',
                wrap: true,
              },
            ],
            margin: teamIndex === 0 ? 'none' : 'lg',
            alignItems: 'center',
          };

          const ticketRows: FlexBox[] = team.tickets.map(ticket => ({
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: ticket.ticketCode,
                size: 'sm',
                weight: 'bold',
                color: '#43A047',
              },
              {
                type: 'text',
                text: ticket.summary || '-',
                size: 'xs',
                color: '#666666',
                wrap: true,
                margin: 'xs',
              },
            ],
            margin: 'sm',
            paddingStart: '36px',
          }));

          return [teamHeader, ...ticketRows];
        })
      : [{
          type: 'text',
          text: 'ไม่มีตั๋วที่ยืนยันช่างแล้วสำหรับวันนี้',
          size: 'sm',
          color: '#888888',
          align: 'center',
          wrap: true,
        } as FlexText];

    return {
      type: 'bubble',
      size: 'mega',
      styles: {
        header: {
          backgroundColor: '#5C6BC0',
        },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📅 ตั๋ววันนี้`,
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: `${teams.length} ทีม • ${totalTickets} ตั๋ว`,
            size: 'sm',
            color: '#E8EAF6',
            margin: 'xs',
          },
          {
            type: 'text',
            text: date,
            size: 'xs',
            color: '#C5CAE9',
            margin: 'xs',
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: teamContents,
        paddingAll: '16px',
        spacing: 'none',
      },
    };
  }

  /**
   * Create my tickets bubble (assigned to current user) with full details
   */
  static createMyTicketsBubble(
    tickets: Array<{
      ticketId: string;
      ticketCode: string;
      siteName: string;
      workType: string;
      details: string;
      appointmentTime: string;
      contactName: string;
      contactPhone: string;
      submittedCount: number;
      location: string;
      mapUrl: string;
      merchandise: string;
      attachmentCount: number;
    }>,
    date: string,
    employeeName: string,
    showSubmitButton: boolean = false
  ): FlexBubble {
    // Create detailed ticket cards
    const ticketContents: FlexComponent[] = tickets.length > 0
      ? tickets.map((ticket, index) => ({
          type: 'box',
          layout: 'vertical',
          contents: [
            // Header row: ticket code + time + submitted indicator
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: ticket.ticketCode,
                  size: 'md',
                  weight: 'bold',
                  color: '#43A047',
                  flex: 1,
                },
                ...(ticket.submittedCount > 0 ? [{
                  type: 'text',
                  text: `✅ ${ticket.submittedCount}`,
                  size: 'sm',
                  color: '#43A047',
                  flex: 0,
                } as FlexText] : []),
                ticket.appointmentTime ? {
                  type: 'text',
                  text: `🕐 ${ticket.appointmentTime}`,
                  size: 'sm',
                  color: '#666666',
                  flex: 0,
                  margin: ticket.submittedCount > 0 ? 'md' : 'none',
                } : {
                  type: 'filler',
                },
              ],
            },
            // Site name
            {
              type: 'text',
              text: ticket.siteName,
              size: 'sm',
              color: '#5C6BC0',
              weight: 'bold',
              margin: 'sm',
              wrap: true,
            },
            // Location with map link
            ...(ticket.location ? [{
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: `📍 ${ticket.location}`,
                  size: 'xs',
                  color: '#666666',
                  flex: 1,
                  wrap: true,
                },
                ...(ticket.mapUrl ? [{
                  type: 'text',
                  text: '🗺️',
                  size: 'xs',
                  flex: 0,
                  action: {
                    type: 'uri',
                    label: 'แผนที่',
                    uri: ticket.mapUrl,
                  },
                } as FlexText] : []),
              ],
              margin: 'xs',
            } as FlexBox] : []),
            // Description/Details
            {
              type: 'text',
              text: ticket.details || '-',
              size: 'sm',
              color: '#333333',
              wrap: true,
              margin: 'xs',
            },
            // Merchandise (equipment)
            ...(ticket.merchandise ? [{
              type: 'text',
              text: `🔧 ${ticket.merchandise}`,
              size: 'xs',
              color: '#FF6F00',
              wrap: true,
              margin: 'xs',
            } as FlexText] : []),
            // Attachments indicator
            ...(ticket.attachmentCount > 0 ? [{
              type: 'text',
              text: `📎 ${ticket.attachmentCount} ไฟล์แนบ`,
              size: 'xs',
              color: '#888888',
              margin: 'xs',
            } as FlexText] : []),
            // Work type badge + Call button row (flex-start)
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: ticket.workType,
                      size: 'xs',
                      color: '#FFFFFF',
                    },
                  ],
                  backgroundColor: '#5C6BC0',
                  cornerRadius: '4px',
                  paddingAll: '4px',
                  paddingStart: '8px',
                  paddingEnd: '8px',
                },
                ...(ticket.contactPhone ? [{
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: `📞 ${ticket.contactName || 'โทร'}`,
                      size: 'xs',
                      color: '#FFFFFF',
                    },
                  ],
                  backgroundColor: '#43A047',
                  cornerRadius: '4px',
                  paddingAll: '4px',
                  paddingStart: '8px',
                  paddingEnd: '8px',
                  margin: 'sm',
                  action: {
                    type: 'uri',
                    label: 'โทร',
                    uri: `tel:${ticket.contactPhone}`,
                  },
                } as FlexBox] : []),
              ],
              margin: 'sm',
            },
            // Submit work buttons (for technicians)
            ...(showSubmitButton ? [{
              type: 'box',
              layout: 'horizontal',
              contents: [
                // View submitted button (if has submissions)
                ...(ticket.submittedCount > 0 ? [{
                  type: 'button',
                  action: {
                    type: 'postback',
                    label: `📋 ดู (${ticket.submittedCount})`,
                    data: JSON.stringify({ action: 'view_ticket_files', ticketId: ticket.ticketId, ticketCode: ticket.ticketCode }),
                    displayText: `ดูไฟล์ ${ticket.ticketCode}`,
                  },
                  style: 'secondary',
                  height: 'sm',
                  flex: 1,
                } as FlexButton] : []),
                // Submit button
                {
                  type: 'button',
                  action: {
                    type: 'postback',
                    label: ticket.submittedCount > 0 ? '📤 ส่งเพิ่ม' : '📤 ส่งงาน',
                    data: JSON.stringify({ action: 'submit_work', ticketId: ticket.ticketId, ticketCode: ticket.ticketCode }),
                    displayText: `ส่งงาน ${ticket.ticketCode}`,
                  },
                  style: 'primary',
                  color: ticket.submittedCount > 0 ? '#FF9800' : '#43A047',
                  height: 'sm',
                  flex: 1,
                  margin: ticket.submittedCount > 0 ? 'sm' : 'none',
                } as FlexButton,
              ],
              spacing: 'sm',
              margin: 'md',
            } as FlexBox] : []),
          ],
          backgroundColor: index % 2 === 0 ? '#FAFAFA' : '#FFFFFF',
          cornerRadius: '8px',
          paddingAll: '12px',
          margin: index === 0 ? 'none' : 'md',
        } as FlexBox))
      : [{
          type: 'text',
          text: 'ไม่มีงานที่ได้รับมอบหมายวันนี้',
          size: 'sm',
          color: '#888888',
          align: 'center',
        } as FlexText];

    return {
      type: 'bubble',
      size: 'mega',
      styles: {
        header: {
          backgroundColor: '#43A047',
        },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `👷 งานของฉัน (${tickets.length})`,
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: employeeName,
            size: 'sm',
            color: '#E8F5E9',
            margin: 'sm',
          },
          {
            type: 'text',
            text: date,
            size: 'xs',
            color: '#C8E6C9',
            margin: 'xs',
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: ticketContents,
        paddingAll: '12px',
        spacing: 'none',
      },
    };
  }

  /**
   * Create ticket files carousel - show submitted files with images
   */
  static createTicketFilesCarousel(
    files: Array<{
      id: string;
      file_name: string;
      file_url: string;
      file_size: number | null;
      mime_type: string | null;
      status: string;
      created_at: string;
    }>,
    ticketCode: string
  ): FlexCarousel {
    const bubbles: FlexBubble[] = files.slice(0, 10).map(file => {
      const isImage = file.mime_type?.startsWith('image/');
      const statusText = file.status === 'approved' ? '✅ อนุมัติแล้ว'
        : file.status === 'rejected' ? '❌ ถูกปฏิเสธ'
        : '⏳ รออนุมัติ';
      const statusColor = file.status === 'approved' ? '#43A047'
        : file.status === 'rejected' ? '#E53935'
        : '#FF9800';

      return {
        type: 'bubble',
        size: 'kilo',
        hero: isImage ? {
          type: 'image',
          url: file.file_url,
          size: 'full',
          aspectRatio: '4:3',
          aspectMode: 'cover',
        } : undefined,
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: file.file_name,
              size: 'sm',
              weight: 'bold',
              wrap: true,
              maxLines: 2,
            },
            {
              type: 'text',
              text: statusText,
              size: 'xs',
              color: statusColor,
              margin: 'sm',
            },
          ],
          paddingAll: '12px',
        },
      } as FlexBubble;
    });

    return {
      type: 'carousel',
      contents: bubbles,
    };
  }

  /**
   * Create menu bubble with available commands based on role
   */
  static createMenuBubble(isTechnician: boolean): FlexBubble {
    const headerColor = isTechnician ? '#43A047' : '#5C6BC0';
    const roleText = isTechnician ? 'ช่างเทคนิค' : 'พนักงานทั่วไป';

    // Different commands for technicians vs non-technicians
    const commands: FlexBox[] = isTechnician
      ? [
          // Technician commands
          this.createCommandRow('👷', 'วันนี้', 'ดูงานที่ได้รับมอบหมาย'),
          this.createCommandRow('📤', 'ส่งงาน', 'กดปุ่มในรายการตั๋ว'),
          this.createCommandRow('✅', 'เสร็จ', 'เสร็จสิ้นการส่งงาน'),
          this.createCommandRow('⏳', 'สถานะ', 'ดูไฟล์ที่ส่งไปแล้ว'),
        ]
      : [
          // Non-technician commands
          this.createCommandRow('📅', 'วันนี้', 'ดูตั๋ววันนี้ทั้งหมด'),
          this.createCommandRow('📋', 'รายการ', 'ดูไฟล์รอส่ง'),
          this.createCommandRow('⏳', 'สถานะ', 'ดูไฟล์ที่ส่งไปแล้ว'),
          this.createCommandRow('🔗', 'เชื่อมตั๋ว', 'เชื่อมไฟล์กับตั๋ว'),
          this.createCommandRow('🗑️', 'ลบทั้งหมด', 'ลบไฟล์รอส่งทั้งหมด'),
          this.createCommandRow('🎫', 'PDE-XXX', 'พิมพ์รหัสตั๋วเพื่อส่งไฟล์'),
        ];

    // Workflow description
    const workflowSteps = isTechnician
      ? [
          '1. พิมพ์ "วันนี้" ดูงาน',
          '2. กด "ส่งงาน" ที่ตั๋ว',
          '3. ส่งรูป (อัตโนมัติ)',
          '4. พิมพ์ "เสร็จ"',
        ]
      : [
          '1. ส่งรูปมาก่อน',
          '2. พิมพ์รหัสตั๋ว เช่น PDE-904',
          '3. รอการอนุมัติ',
        ];

    return {
      type: 'bubble',
      size: 'mega',
      styles: {
        header: {
          backgroundColor: headerColor,
        },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 เมนูคำสั่ง',
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: roleText,
            size: 'sm',
            color: '#FFFFFF',
            margin: 'sm',
          },
        ],
        paddingAll: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          // Workflow section
          {
            type: 'text',
            text: '📝 ขั้นตอนการใช้งาน',
            weight: 'bold',
            size: 'sm',
            color: '#333333',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: workflowSteps.map(step => ({
              type: 'text',
              text: step,
              size: 'xs',
              color: '#666666',
              margin: 'xs',
            } as FlexText)),
            margin: 'sm',
            backgroundColor: '#F5F5F5',
            cornerRadius: '8px',
            paddingAll: '12px',
          },
          {
            type: 'separator',
            margin: 'xl',
            color: '#E0E0E0',
          },
          // Commands section
          {
            type: 'text',
            text: '⌨️ คำสั่งที่ใช้ได้',
            weight: 'bold',
            size: 'sm',
            color: '#333333',
            margin: 'xl',
          },
          // Command list
          {
            type: 'box',
            layout: 'vertical',
            contents: commands,
            margin: 'sm',
            spacing: 'sm',
          },
        ],
        paddingAll: '20px',
      },
    };
  }

  /**
   * Create a command row for menu
   */
  private static createCommandRow(icon: string, command: string, description: string): FlexBox {
    return {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: icon,
          size: 'sm',
          flex: 0,
        },
        {
          type: 'text',
          text: command,
          size: 'sm',
          weight: 'bold',
          color: '#5C6BC0',
          flex: 0,
          margin: 'sm',
        },
        {
          type: 'text',
          text: description,
          size: 'xs',
          color: '#888888',
          flex: 1,
          margin: 'md',
          align: 'end',
        },
      ],
      alignItems: 'center',
      paddingAll: '8px',
      backgroundColor: '#FAFAFA',
      cornerRadius: '4px',
    };
  }

  /**
   * Create linked files carousel for viewing files pending approval
   */
  static createLinkedFilesCarousel(
    files: LinkedFileForLine[],
    totalCount?: number,
    currentPage: number = 1,
    totalPages: number = 1
  ): FlexCarousel {
    const displayTotalCount = totalCount ?? files.length;
    const linkedCount = files.filter(f => f.status === 'linked').length;
    const approvedCount = files.filter(f => f.status === 'approved').length;
    const rejectedCount = files.filter(f => f.status === 'rejected').length;
    const hasPrevPage = currentPage > 1;
    const hasNextPage = currentPage < totalPages;

    // Summary bubble
    const summaryBubble: FlexBubble = {
      type: 'bubble',
      size: 'kilo',
      styles: {
        header: {
          backgroundColor: '#2E86AB',
        },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 รอการอนุมัติ',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: totalPages > 1
              ? `${displayTotalCount} ไฟล์ (หน้า ${currentPage}/${totalPages})`
              : `${displayTotalCount} ไฟล์ที่ส่งแล้ว`,
            size: 'xs',
            color: '#FFFFFF',
            margin: 'sm',
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${linkedCount}`,
                    size: 'xl',
                    weight: 'bold',
                    color: '#2196F3',
                    align: 'center',
                  },
                  {
                    type: 'text',
                    text: 'รออนุมัติ',
                    size: 'xxs',
                    color: '#888888',
                    align: 'center',
                  },
                ],
                flex: 1,
              },
              {
                type: 'separator',
                color: '#E0E0E0',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${approvedCount}`,
                    size: 'xl',
                    weight: 'bold',
                    color: '#4CAF50',
                    align: 'center',
                  },
                  {
                    type: 'text',
                    text: 'อนุมัติแล้ว',
                    size: 'xxs',
                    color: '#888888',
                    align: 'center',
                  },
                ],
                flex: 1,
              },
              {
                type: 'separator',
                color: '#E0E0E0',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${rejectedCount}`,
                    size: 'xl',
                    weight: 'bold',
                    color: '#F44336',
                    align: 'center',
                  },
                  {
                    type: 'text',
                    text: 'ปฏิเสธ',
                    size: 'xxs',
                    color: '#888888',
                    align: 'center',
                  },
                ],
                flex: 1,
              },
            ],
            paddingAll: '12px',
          },
          {
            type: 'separator',
            margin: 'lg',
            color: '#E0E0E0',
          },
          {
            type: 'text',
            text: '💡 ปัดซ้ายเพื่อดูไฟล์',
            size: 'xs',
            color: '#888888',
            margin: 'lg',
            align: 'center',
          },
        ],
        paddingAll: '16px',
      },
      footer: totalPages > 1 ? {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '◀ ก่อนหน้า',
              data: JSON.stringify({ action: 'view_linked_files_page', page: currentPage - 1 }),
              displayText: `หน้า ${currentPage - 1}`,
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
            ...(hasPrevPage ? {} : { color: '#CCCCCC' }),
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'ถัดไป ▶',
              data: JSON.stringify({ action: 'view_linked_files_page', page: currentPage + 1 }),
              displayText: `หน้า ${currentPage + 1}`,
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
            ...(hasNextPage ? {} : { color: '#CCCCCC' }),
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#FAFAFA',
      } : undefined,
    };

    // File bubbles
    const fileBubbles = files.map(file => this.createLinkedFileBubble(file));

    return {
      type: 'carousel',
      contents: [summaryBubble, ...fileBubbles],
    };
  }

  /**
   * Create single linked file bubble with status and unlink action
   */
  static createLinkedFileBubble(file: LinkedFileForLine): FlexBubble {
    const isImage = file.mime_type?.startsWith('image/');
    const statusConfig = {
      linked: { color: '#2196F3', text: 'รออนุมัติ', icon: '⏳' },
      approved: { color: '#4CAF50', text: 'อนุมัติแล้ว', icon: '✅' },
      rejected: { color: '#F44336', text: 'ปฏิเสธ', icon: '❌' },
    };
    const status = statusConfig[file.status];

    const bodyContents: FlexBox['contents'] = [
      // File info row
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: isImage ? '🖼️' : '📄',
                size: 'xl',
                align: 'center',
              },
            ],
            width: '44px',
            height: '44px',
            backgroundColor: '#F5F5F5',
            cornerRadius: '8px',
            justifyContent: 'center',
            alignItems: 'center',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: file.file_name,
                weight: 'bold',
                size: 'sm',
                wrap: true,
                maxLines: 2,
                color: '#333333',
              },
              {
                type: 'text',
                text: file.ticket?.ticket_code || '-',
                size: 'xs',
                color: '#666666',
              },
            ],
            flex: 1,
            paddingStart: '12px',
          },
        ],
      },
      // Status badge
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: status.icon,
            size: 'sm',
            flex: 0,
          },
          {
            type: 'text',
            text: status.text,
            size: 'sm',
            weight: 'bold',
            color: status.color,
            margin: 'sm',
          },
        ],
        margin: 'lg',
        paddingAll: '8px',
        backgroundColor: `${status.color}15`,
        cornerRadius: '4px',
      },
    ];

    // Add rejection reason if rejected
    if (file.status === 'rejected' && file.rejection_reason) {
      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เหตุผล:',
            size: 'xs',
            color: '#888888',
          },
          {
            type: 'text',
            text: file.rejection_reason,
            size: 'xs',
            color: '#F44336',
            wrap: true,
            maxLines: 3,
          },
        ],
        margin: 'md',
        paddingAll: '8px',
        backgroundColor: '#FFF3F3',
        cornerRadius: '4px',
      });
    }

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        paddingAll: '16px',
      },
    };

    // Add unlink button only for linked status
    if (file.status === 'linked') {
      bubble.footer = {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '↩️ ยกเลิกส่ง',
              data: JSON.stringify({ action: 'unlink_file', fileId: file.id }),
              displayText: 'ยกเลิกส่งไฟล์',
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#FAFAFA',
      };
    }

    // Add image preview as hero if it's an image
    if (isImage && file.file_url) {
      bubble.hero = {
        type: 'image',
        url: file.file_url,
        size: 'full',
        aspectRatio: '4:3',
        aspectMode: 'cover',
      };
    }

    return bubble;
  }

  /**
   * Create no linked files bubble
   */
  static createNoLinkedFilesBubble(): FlexBubble {
    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📭',
                size: '4xl',
                align: 'center',
              },
            ],
            paddingAll: '24px',
          },
          {
            type: 'text',
            text: 'ไม่มีไฟล์ที่ส่งแล้ว',
            weight: 'bold',
            size: 'md',
            align: 'center',
            color: '#888888',
          },
          {
            type: 'text',
            text: 'ไฟล์ที่เชื่อมกับตั๋วจะแสดงที่นี่',
            size: 'xs',
            align: 'center',
            color: '#AAAAAA',
            margin: 'sm',
          },
        ],
        paddingAll: '24px',
        justifyContent: 'center',
      },
    };
  }

  /**
   * Create approver files carousel for managing all pending submissions
   */
  static createApproverFilesCarousel(
    files: Array<{
      id: string;
      file_name: string;
      file_url: string;
      file_size: number | null;
      mime_type: string | null;
      created_at: string;
      employee: { name: string } | null;
      ticket: { id: string; ticket_code: string } | null;
    }>,
    totalCount: number,
    currentPage: number = 1,
    totalPages: number = 1
  ): FlexCarousel {
    const hasPrevPage = currentPage > 1;
    const hasNextPage = currentPage < totalPages;

    // Summary bubble
    const summaryBubble: FlexBubble = {
      type: 'bubble',
      size: 'kilo',
      styles: {
        header: {
          backgroundColor: '#FF6F00',
        },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 รออนุมัติ',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: totalPages > 1
              ? `${totalCount} ไฟล์ (หน้า ${currentPage}/${totalPages})`
              : `${totalCount} ไฟล์รออนุมัติ`,
            size: 'xs',
            color: '#FFFFFF',
            margin: 'sm',
          },
        ],
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💡 ปัดซ้ายเพื่อดูไฟล์และอนุมัติ',
            size: 'xs',
            color: '#888888',
            align: 'center',
          },
        ],
        paddingAll: '16px',
      },
      footer: totalPages > 1 ? {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '◀ ก่อนหน้า',
              data: JSON.stringify({ action: 'approver_files_page', page: currentPage - 1 }),
              displayText: `หน้า ${currentPage - 1}`,
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
            ...(hasPrevPage ? {} : { color: '#CCCCCC' }),
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'ถัดไป ▶',
              data: JSON.stringify({ action: 'approver_files_page', page: currentPage + 1 }),
              displayText: `หน้า ${currentPage + 1}`,
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
            ...(hasNextPage ? {} : { color: '#CCCCCC' }),
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#FAFAFA',
      } : undefined,
    };

    // File bubbles with approve/reject buttons
    const fileBubbles = files.map(file => this.createApproverFileBubble(file));

    return {
      type: 'carousel',
      contents: [summaryBubble, ...fileBubbles],
    };
  }

  /**
   * Create single file bubble for approver with approve/reject actions
   */
  static createApproverFileBubble(file: {
    id: string;
    file_name: string;
    file_url: string;
    file_size: number | null;
    mime_type: string | null;
    created_at: string;
    employee: { name: string } | null;
    ticket: { id: string; ticket_code: string } | null;
  }): FlexBubble {
    const isImage = file.mime_type?.startsWith('image/');

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          // File info row
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: isImage ? '🖼️' : '📄',
                    size: 'xl',
                    align: 'center',
                  },
                ],
                width: '44px',
                height: '44px',
                backgroundColor: '#FFF3E0',
                cornerRadius: '8px',
                justifyContent: 'center',
                alignItems: 'center',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: file.file_name,
                    weight: 'bold',
                    size: 'sm',
                    wrap: true,
                    maxLines: 2,
                    color: '#333333',
                  },
                  {
                    type: 'text',
                    text: file.ticket?.ticket_code || '-',
                    size: 'xs',
                    color: '#FF6F00',
                    weight: 'bold',
                  },
                ],
                flex: 1,
                paddingStart: '12px',
              },
            ],
          },
          // Submitter info
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `👤 ${file.employee?.name || 'ไม่ระบุ'}`,
                size: 'xs',
                color: '#666666',
              },
              {
                type: 'text',
                text: this.formatRelativeTime(file.created_at),
                size: 'xs',
                color: '#888888',
                align: 'end',
              },
            ],
            margin: 'md',
          },
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '✅ อนุมัติ',
              data: JSON.stringify({ action: 'approve_file', fileId: file.id }),
              displayText: 'อนุมัติไฟล์',
            },
            style: 'primary',
            color: '#4CAF50',
            height: 'sm',
            flex: 1,
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '❌ ปฏิเสธ',
              data: JSON.stringify({ action: 'reject_file', fileId: file.id }),
              displayText: 'ปฏิเสธไฟล์',
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#FAFAFA',
      },
    };

    // Add image preview as hero if it's an image
    if (isImage && file.file_url) {
      bubble.hero = {
        type: 'image',
        url: file.file_url,
        size: 'full',
        aspectRatio: '4:3',
        aspectMode: 'cover',
      };
    }

    return bubble;
  }
}
