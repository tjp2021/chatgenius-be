export interface WsResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  memberCount: number;
  members: ChannelMember[];
}

export interface ChannelMember {
  userId: string;
  role: 'OWNER' | 'MEMBER';
  user: User;
}

export interface User {
  id: string;
  name: string;
  fullName: string;
  imageUrl?: string;
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deliveryStatus: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  user: User;
}

// Client -> Server Event Payloads
export interface ChannelCreatePayload {
  name: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  description?: string;
  memberIds?: string[];
}

export interface ChannelUpdatePayload {
  channelId: string;
  name?: string;
  description?: string;
}

export interface ChannelJoinPayload {
  channelId: string;
}

export interface ChannelLeavePayload {
  channelId: string;
  shouldDelete?: boolean;
}

export interface ChannelMemberRolePayload {
  channelId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
}

export interface MessageSendPayload {
  channelId: string;
  content: string;
}

export interface MessageStatusPayload {
  messageId: string;
}

export interface MessageTypingPayload {
  channelId: string;
}

// Server -> Client Event Payloads
export interface ChannelMemberCountPayload {
  channelId: string;
  count: number;
}

export interface MessageStatusUpdatePayload {
  messageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  userId: string;
}

export interface UserTypingPayload {
  channelId: string;
  userId: string;
}

export interface AuthPayload {
  token: string;
  userId: string;
}

// Room Event Payloads
export interface RoomMemberJoinedPayload {
  channelId: string;
  userId: string;
  user: User;
  timestamp: string;
}

export interface RoomMemberLeftPayload {
  channelId: string;
  userId: string;
  timestamp: string;
}

export interface RoomActivityPayload {
  channelId: string;
  memberCount: number;
  lastActivity: string;
  activeMembers: User[];
}

export interface MessageReactionPayload {
  messageId: string;
  emoji: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: User[];
}

export interface MessageReactionEvent {
  messageId: string;
  emoji: string;
  reactions: Reaction[];
} 