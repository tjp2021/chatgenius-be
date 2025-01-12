import { Channel, ChannelMember } from '@prisma/client';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelQuery } from '../types/channel.types';

export interface IChannelCore {
  // Core channel operations
  createChannel(userId: string, data: CreateChannelDto): Promise<Channel>;
  updateChannel(userId: string, channelId: string, data: UpdateChannelDto): Promise<Channel>;
  deleteChannel(userId: string, channelId: string): Promise<void>;
  getChannel(userId: string, channelId: string): Promise<Channel>;
  getChannels(userId: string, query: ChannelQuery): Promise<Channel[]>;

  // Member operations
  addMember(channelId: string, userId: string, role: string): Promise<ChannelMember>;
  removeMember(channelId: string, userId: string): Promise<void>;
  getMembers(channelId: string): Promise<ChannelMember[]>;
  getMember(channelId: string, userId: string): Promise<ChannelMember | null>;
}

export interface IChannelMembership {
  // Membership operations
  joinChannel(userId: string, channelId: string): Promise<void>;
  leaveChannel(userId: string, channelId: string): Promise<void>;
  updateMemberRole(channelId: string, userId: string, role: string): Promise<ChannelMember>;
}

export interface IChannelInvitation {
  // Invitation operations
  inviteMember(channelId: string, inviterId: string, inviteeId: string): Promise<void>;
  acceptInvitation(invitationId: string, userId: string): Promise<void>;
  rejectInvitation(invitationId: string, userId: string): Promise<void>;
  getPendingInvitations(userId: string): Promise<any[]>;
}

export interface IChannelValidation {
  // Validation operations
  validateCreateChannel(userId: string, data: CreateChannelDto): Promise<void>;
  validateUpdateChannel(userId: string, channelId: string, data: UpdateChannelDto): Promise<void>;
  validateDeleteChannel(userId: string, channelId: string): Promise<void>;
  validateJoinChannel(userId: string, channelId: string): Promise<void>;
  validateLeaveChannel(userId: string, channelId: string): Promise<void>;
} 