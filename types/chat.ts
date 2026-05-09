export enum MessageStatus {
  SENDING = "sending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
}

export interface Contact {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  lastMessage?: { content: string; createdAt: string };
  unreadCount?: number;
  isOnline?: boolean;
  customChatId?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  isChatLock?: boolean;
  publicKey?: string;
  isGroupChat?: boolean;
  participants?: Contact[];
}


export interface Attachment {
  url: string;
  type: "image" | "video" | "audio" | "file" | "VoiceMessage";
  name: string;
  size: number;
  mimeType: string;
  publicId?: string;
  path?: string;
}

export interface Message {
  _id?: string;
  senderId: string;
  isTemp?: boolean;
  uploadProgress?: number;
  attachments?: Attachment[];
  content: string;
  createdAt?: string;
  messageStatus?: MessageStatus;
  status?: MessageStatus;
  isImportant?: boolean;
  is_edited?: boolean;
  isForwarded?: boolean;
  is_deleted_for_everyone?: boolean;
  replyTo?: { _id: string; content: string; senderId: string } | null;
  reactions?:
    | { [emoji: string]: string[] }
    | Array<{ emoji: string; userIds?: string[]; userId?: string }>;
}

export interface ContextMenuState {
  msg: Message;
  isMine: boolean;
  position: { x: number; y: number; flip: boolean };
}

export type StorageProvider = "cloudinary" | "supabase";
