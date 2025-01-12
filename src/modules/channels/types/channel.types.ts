import { Channel, ChannelMember, ChannelType, MemberRole } from '@prisma/client';

// Query types
export interface ChannelQuery {
  view?: 'sidebar' | 'browse' | 'leave';
  search?: string;
  cursor?: string;
  limit?: number;
}

// Event types
export interface ChannelEvent {
  id: string;
  type: ChannelEventType;
  timestamp: Date;
  channelId: string;
  data: ChannelEventData;
}

export interface ChannelEventData {
  channelId: string;
  channel?: Channel;
  memberId?: string;
  memberRole?: MemberRole;
  userId?: string;
  user?: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  role?: MemberRole;
}

export const ChannelEventType = {
  CHANNEL_CREATED: 'channel.created',
  CHANNEL_UPDATED: 'channel.updated',
  CHANNEL_DELETED: 'channel.deleted',
  MEMBER_JOINED: 'channel.member.joined',
  MEMBER_LEFT: 'channel.member.left',
  MEMBER_ROLE_UPDATED: 'channel.member.role.updated',
} as const;

export type ChannelEventType = typeof ChannelEventType[keyof typeof ChannelEventType];

// Response types
export interface ChannelResponse extends Channel {
  members: ChannelMember[];
  _count: {
    messages: number;
    members: number;
  };
}

export interface ChannelMemberResponse extends ChannelMember {
  user: {
    id: string;
    name: string;
    imageUrl: string | null;
    isOnline: boolean;
  };
}

// Utility types
export interface ChannelInclude {
  members?: boolean | { include: { user: boolean } };
  messages?: boolean | { 
    take?: number;
    orderBy?: { createdAt: 'asc' | 'desc' };
    include?: { user: boolean };
  };
  _count?: boolean | { select: { messages: boolean } };
}

export interface JoinChannelEvent {
  channelId: string;
}

export interface LeaveChannelEvent {
  channelId: string;
}

export interface ChannelJoinedResponse {
  channelId: string;
  userId: string;
  timestamp: Date;
}

export interface ChannelLeftResponse {
  channelId: string;
  userId: string;
  timestamp: Date;
} 