import { Channel, ChannelMember, MemberRole } from '@prisma/client';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelQuery } from '../types/channel.types';

export const CHANNEL_REPOSITORY = Symbol('CHANNEL_REPOSITORY');

export interface IChannelRepository {
  create(userId: string, data: CreateChannelDto): Promise<Channel>;
  update(channelId: string, data: UpdateChannelDto): Promise<Channel>;
  delete(channelId: string): Promise<void>;
  findById(channelId: string): Promise<Channel | null>;
  findAll(userId: string, query: ChannelQuery): Promise<Channel[]>;
  findMembers(channelId: string): Promise<ChannelMember[]>;
  findMember(channelId: string, userId: string): Promise<ChannelMember | null>;
  addMember(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember>;
  removeMember(channelId: string, userId: string): Promise<void>;
  updateMemberRole(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember>;
  updateLastActivity(channelId: string): Promise<void>;
  incrementMemberCount(channelId: string): Promise<void>;
  decrementMemberCount(channelId: string): Promise<void>;
} 