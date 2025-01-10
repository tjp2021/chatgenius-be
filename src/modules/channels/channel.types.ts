import { Channel } from '../../core/events/event.types';

export enum ChannelType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  DM = 'DM'
}

export enum MemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}

export interface CreateChannelDto {
  name: string;
  description?: string;
  type: ChannelType;
}

export interface UpdateChannelDto {
  name?: string;
  description?: string;
  type?: ChannelType;
}

export interface ChannelMember {
  userId: string;
  channelId: string;
  role: MemberRole;
  joinedAt: Date;
  user?: {
    id: string;
    name?: string;
    imageUrl?: string;
  };
}

export interface ChannelQuery {
  type?: ChannelType;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface ChannelRepository {
  create(userId: string, data: CreateChannelDto): Promise<Channel>;
  update(channelId: string, data: UpdateChannelDto): Promise<Channel>;
  delete(channelId: string): Promise<void>;
  findById(channelId: string): Promise<Channel | null>;
  findAll(userId: string, query: ChannelQuery): Promise<Channel[]>;
  
  // Member management
  findMember(channelId: string, userId: string): Promise<ChannelMember | null>;
  findMembers(channelId: string): Promise<ChannelMember[]>;
  addMember(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember>;
  removeMember(channelId: string, userId: string): Promise<void>;
} 