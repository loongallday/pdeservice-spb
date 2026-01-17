/**
 * LINE Webhook Types
 */

// Webhook event source
export interface LineSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

// Base webhook event
export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: LineSource;
  replyToken?: string;
  webhookEventId: string;
  deliveryContext: {
    isRedelivery: boolean;
  };
}

// Message event
export interface LineMessageEvent extends LineWebhookEvent {
  type: 'message';
  message: LineMessage;
}

// Postback event
export interface LinePostbackEvent extends LineWebhookEvent {
  type: 'postback';
  postback: {
    data: string;
    params?: Record<string, string>;
  };
}

// Follow event (user adds bot as friend)
export interface LineFollowEvent extends LineWebhookEvent {
  type: 'follow';
}

// Unfollow event
export interface LineUnfollowEvent extends LineWebhookEvent {
  type: 'unfollow';
}

// Message types
export type LineMessage =
  | LineTextMessage
  | LineImageMessage
  | LineVideoMessage
  | LineAudioMessage
  | LineFileMessage
  | LineStickerMessage;

export interface LineTextMessage {
  id: string;
  type: 'text';
  text: string;
  emojis?: Array<{
    index: number;
    length: number;
    productId: string;
    emojiId: string;
  }>;
}

export interface LineImageMessage {
  id: string;
  type: 'image';
  contentProvider: {
    type: 'line' | 'external';
    originalContentUrl?: string;
    previewImageUrl?: string;
  };
}

export interface LineVideoMessage {
  id: string;
  type: 'video';
  duration: number;
  contentProvider: {
    type: 'line' | 'external';
    originalContentUrl?: string;
    previewImageUrl?: string;
  };
}

export interface LineAudioMessage {
  id: string;
  type: 'audio';
  duration: number;
  contentProvider: {
    type: 'line' | 'external';
    originalContentUrl?: string;
  };
}

export interface LineFileMessage {
  id: string;
  type: 'file';
  fileName: string;
  fileSize: number;
}

export interface LineStickerMessage {
  id: string;
  type: 'sticker';
  packageId: string;
  stickerId: string;
}

// Webhook request body
export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

// LINE API response types
export interface LineProfile {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
}

// Postback data structure
export interface PostbackData {
  action: string;
  fileId?: string;
  ticketId?: string;
  [key: string]: unknown;
}

// Flex message types
export interface FlexBubble {
  type: 'bubble';
  size?: 'nano' | 'micro' | 'kilo' | 'mega' | 'giga';
  header?: FlexBox;
  hero?: FlexImage | FlexBox;
  body?: FlexBox;
  footer?: FlexBox;
  styles?: {
    header?: FlexBlockStyle;
    hero?: FlexBlockStyle;
    body?: FlexBlockStyle;
    footer?: FlexBlockStyle;
  };
}

export interface FlexCarousel {
  type: 'carousel';
  contents: FlexBubble[];
}

export interface FlexBox {
  type: 'box';
  layout: 'horizontal' | 'vertical' | 'baseline';
  contents: FlexComponent[];
  flex?: number;
  spacing?: string;
  margin?: string;
  paddingAll?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingStart?: string;
  paddingEnd?: string;
  backgroundColor?: string;
  borderWidth?: string;
  borderColor?: string;
  cornerRadius?: string;
  action?: FlexAction;
}

export interface FlexText {
  type: 'text';
  text: string;
  flex?: number;
  size?: string;
  weight?: 'regular' | 'bold';
  color?: string;
  wrap?: boolean;
  maxLines?: number;
  align?: 'start' | 'end' | 'center';
  gravity?: 'top' | 'bottom' | 'center';
  margin?: string;
  action?: FlexAction;
}

export interface FlexButton {
  type: 'button';
  action: FlexAction;
  flex?: number;
  margin?: string;
  height?: 'sm' | 'md';
  style?: 'primary' | 'secondary' | 'link';
  color?: string;
  gravity?: 'top' | 'bottom' | 'center';
}

export interface FlexImage {
  type: 'image';
  url: string;
  flex?: number;
  size?: string;
  aspectRatio?: string;
  aspectMode?: 'cover' | 'fit';
  backgroundColor?: string;
  action?: FlexAction;
}

export interface FlexSeparator {
  type: 'separator';
  margin?: string;
  color?: string;
}

export interface FlexFiller {
  type: 'filler';
  flex?: number;
}

export type FlexComponent = FlexBox | FlexText | FlexButton | FlexImage | FlexSeparator | FlexFiller;

export interface FlexBlockStyle {
  backgroundColor?: string;
  separator?: boolean;
  separatorColor?: string;
}

export type FlexAction = PostbackAction | UriAction | MessageAction;

export interface PostbackAction {
  type: 'postback';
  label: string;
  data: string;
  displayText?: string;
}

export interface UriAction {
  type: 'uri';
  label: string;
  uri: string;
}

export interface MessageAction {
  type: 'message';
  label: string;
  text: string;
}

// Send message types
export interface TextMessage {
  type: 'text';
  text: string;
  emojis?: Array<{
    index: number;
    productId: string;
    emojiId: string;
  }>;
}

export interface FlexMessage {
  type: 'flex';
  altText: string;
  contents: FlexBubble | FlexCarousel;
}

export type SendMessage = TextMessage | FlexMessage | TextMessageWithQuickReply;

// Quick Reply types
export interface QuickReplyItem {
  type: 'action';
  imageUrl?: string;
  action: QuickReplyAction;
}

export type QuickReplyAction = PostbackAction | MessageAction | UriAction;

export interface QuickReply {
  items: QuickReplyItem[];
}

export interface TextMessageWithQuickReply {
  type: 'text';
  text: string;
  quickReply: QuickReply;
}

// File management postback action types
export type FileManagementAction =
  | 'view_files'
  | 'view_files_page'
  | 'view_linked_files'
  | 'view_linked_files_page'
  | 'toggle_select'
  | 'delete_file'
  | 'delete_latest'
  | 'select_all'
  | 'clear_selection'
  | 'unlink_file'
  | 'submit_work'
  | 'view_ticket_files'
  | 'approve_file'
  | 'reject_file'
  | 'approver_files_page';

// Staged file for LINE display
export interface StagedFileForLine {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  metadata: {
    selected?: boolean;
    line_message_id?: string;
  };
}

// Linked file for LINE display (includes ticket info)
export interface LinkedFileForLine {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  status: 'linked' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  ticket: {
    id: string;
    ticket_code: string;
  } | null;
}
