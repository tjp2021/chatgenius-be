import { PrismaClient } from '@prisma/client';

export type PrismaTypes = Awaited<ReturnType<PrismaClient['$connect']>>;

export interface DMTypingStatus {
  userId: string;
  channelId: string;
  timestamp: Date;
  isTyping: boolean;
}

export interface DMChannelActivity {
  channelId: string;
  lastActivity: Date;
  memberCount: number;
}

export interface DMChannelNavigation {
  userId: string;
  channelId: string;
  viewedAt: Date;
  order: number;
}

export interface DMChannelDraft {
  userId: string;
  channelId: string;
  content: string;
  updatedAt: Date;
}

export interface DMParticipantStatus {
  participants: {
    userId: string;
    isOnline: boolean;
    lastSeen: Date | null;
  }[];
}

export interface DMTypingEvent {
  userId: string;
  channelId: string;
  isTyping: boolean;
}

export interface DMReadReceipt {
  userId: string;
  messageId: string;
  readAt: Date;
}

export interface DMReadReceiptEvent {
  userId: string;
  channelId: string;
  messageId: string;
  readAt: Date;
}

export interface DMThread {
  id: string;
  channelId: string;
  parentMessageId: string;
  messages: DMThreadMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DMThreadMessage {
  id: string;
  content: string;
  threadId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  thread: DMThread;
}

export interface EnrichedDMChannel {
  id: string;
  name: string;
  type: 'DM';
  createdAt: Date;
  updatedAt: Date;
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      imageUrl: string | null;
    };
  } | null;
  participants: {
    id: string;
    name: string;
    imageUrl: string | null;
    status: 'online' | 'offline' | 'away';
  }[];
} 