import { 
  User as PrismaUser,
  Channel as PrismaChannel,
  ChannelMember as PrismaChannelMember,
  Message as PrismaMessage,
  ChannelType,
  MemberRole,
  MessageDeliveryStatus,
} from '@prisma/client';

// Re-export Prisma types
export type User = PrismaUser;
export type Channel = PrismaChannel;
export type ChannelMember = PrismaChannelMember;
export type Message = PrismaMessage;

// Event Types
export type MessageEventType = 
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'message.reaction_added'
  | 'message.reaction_removed';

export type ChannelEventType =
  | 'channel.created'
  | 'channel.updated'
  | 'channel.deleted'
  | 'channel.member_joined'
  | 'channel.member_left'
  | 'channel.typing';

export type PresenceEventType =
  | 'presence.online'
  | 'presence.offline'
  | 'presence.away';

export type UserEventType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.typing'
  | 'user.status_changed';

// Base event types
export type EventType = 
  | MessageEventType
  | ChannelEventType
  | PresenceEventType
  | UserEventType;

// Event payloads
export interface TypingIndicator {
  userId: string;
  channelId: string;
  timestamp: Date;
}

export interface Presence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
}

// Map event types to their payload types
export type EventData = {
  // Message events
  'message.created': Message;
  'message.updated': Message;
  'message.deleted': { id: string; channelId: string };
  'message.reaction_added': { messageId: string; userId: string; reaction: string };
  'message.reaction_removed': { messageId: string; userId: string; reaction: string };

  // Channel events
  'channel.created': Channel;
  'channel.updated': Channel;
  'channel.deleted': { id: string };
  'channel.member_joined': { channelId: string; member: ChannelMember };
  'channel.member_left': { channelId: string; userId: string };
  'channel.typing': TypingIndicator;

  // Presence events
  'presence.online': Presence;
  'presence.offline': Presence;
  'presence.away': Presence;

  // User events
  'user.created': User;
  'user.updated': User;
  'user.deleted': { id: string };
  'user.typing': { userId: string; channelId: string; timestamp: Date };
  'user.status_changed': { userId: string; status: 'online' | 'offline' | 'away'; lastSeen: Date };
}; 