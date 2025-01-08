import { ChannelType, MemberRole } from '@prisma/client';

export interface ChannelBrowseResponse {
  id: string;
  name: string;
  description: string | null;
  type: ChannelType;
  _count: {
    members: number;
    messages: number;
  };
  createdAt: string;
  isMember?: boolean;
  joinedAt?: string;
  isOwner?: boolean;
}

export interface PublicChannelsResponse {
  channels: ChannelBrowseResponse[];
}

export interface JoinedChannelsResponse {
  channels: ChannelBrowseResponse[];
}

export interface ChannelJoinResponse {
  success: boolean;
  channel: {
    id: string;
    name: string;
    type: ChannelType;
  };
}

export interface ChannelLeaveResponse {
  success: boolean;
}

export interface ChannelMember {
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
    isOnline: boolean;
  };
}

export interface ChannelMembersResponse {
  members: ChannelMember[];
  _count: {
    total: number;
  };
}

export type ChannelSortBy = 'memberCount' | 'messages' | 'createdAt' | 'name' | 'joinedAt';
export type SortOrder = 'asc' | 'desc';

export interface BrowseOptions {
  search?: string;
  sortBy?: ChannelSortBy;
  sortOrder?: SortOrder;
} 