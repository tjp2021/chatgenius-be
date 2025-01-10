import { ChannelType, MemberRole } from '../../../shared/types/prisma.types';

export type ChannelSortBy = 'createdAt' | 'name' | 'memberCount' | 'messages' | 'joinedAt';
export type SortOrder = 'asc' | 'desc';

export class ChannelBrowseDto {
  type?: ChannelType;
  search?: string;
  cursor?: string;
  limit?: number;
  sortBy?: ChannelSortBy;
  sortOrder?: SortOrder;
}

export interface PublicChannelsResponse {
  channels: Array<{
    id: string;
    name: string;
    description?: string;
    type: ChannelType;
    _count: {
      members: number;
      messages: number;
    };
    createdAt: string;
    isMember: boolean;
    joinedAt: string | null;
  }>;
}

export interface JoinedChannelsResponse {
  channels: Array<{
    id: string;
    name: string;
    description?: string;
    type: ChannelType;
    _count: {
      members: number;
      messages: number;
    };
    createdAt: string;
    joinedAt: string;
    isOwner: boolean;
  }>;
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

export interface ChannelMembersResponse {
  members: Array<{
    userId: string;
    role: MemberRole;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      imageUrl: string;
      isOnline: boolean;
    };
  }>;
  _count: {
    total: number;
  };
}

export interface BrowseOptions {
  search?: string;
  sortBy?: ChannelSortBy;
  sortOrder?: SortOrder;
} 