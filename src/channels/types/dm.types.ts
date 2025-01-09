import { Channel, ChannelType, MemberRole } from '@prisma/client';

export interface DMParticipantStatus {
  participants: {
    userId: string;
    isOnline: boolean;
    lastSeen: Date | null;
  }[];
}

export interface DMTypingStatus {
  channelId: string;
  userId: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface DMTypingEvent {
  channelId: string;
  user: {
    id: string;
    name: string | null;
  };
  isTyping: boolean;
}

export interface DMUser {
  id: string;
  name: string | null;
  imageUrl: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
}

export interface DMMessage {
  id: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
}

export interface DMThreadMessage extends DMMessage {
  parentId: string;
  replyCount: number;
}

export interface DMThread {
  parentMessage: DMMessage;
  replies: DMThreadMessage[];
  participantCount: number;
  lastReplyAt: Date | null;
}

export interface EnrichedDMChannel extends Channel {
  members: {
    userId: string;
    role: MemberRole;
    user: DMUser;
  }[];
  lastMessage: DMMessage | null;
  participants: {
    userId: string;
    isOnline: boolean;
    lastSeen: Date | null;
  }[];
}

export interface DMReadReceipt {
  messageId: string;
  channelId: string;
  userId: string;
  readAt: Date;
}

export interface DMReadReceiptEvent {
  channelId: string;
  messageId: string;
  user: {
    id: string;
    name: string | null;
  };
  readAt: Date;
} 