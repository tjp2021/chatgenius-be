import { Channel, ChannelMember } from '../../core/events/event.types';
import { IsString, IsOptional, IsEnum, IsArray, ArrayNotEmpty } from 'class-validator';
import { Exclude, Transform } from 'class-transformer';

export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface CreateChannelDto {
  name: string;
  description?: string;
  type: ChannelType;
  targetUserId?: string;  // Only used for DM channels
}

export interface UpdateChannelDto {
  channelId: string;
  name?: string;
  description?: string;
  type?: ChannelType;
  memberRole?: {
    userId: string;
    role: MemberRole;
  };
  members?: {
    update: {
      where: {
        channelId_userId: {
          channelId: string;
          userId: string;
        }
      };
      data: {
        role: MemberRole;
      }
    }
  };
}

export interface ChannelQuery {
  type?: ChannelType;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface ChannelRepository {
  create(userId: string, data: Omit<CreateChannelDto, 'memberIds'>, memberIds?: string[]): Promise<Channel>;
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