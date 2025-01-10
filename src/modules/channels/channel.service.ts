import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventService } from '../../core/events/event.service';
import { CreateChannelDto, UpdateChannelDto, ChannelQuery, MemberRole } from './channel.types';
import { PrismaChannelRepository } from './channel.repository';
import { Channel, ChannelMember } from '../../core/events/event.types';

@Injectable()
export class ChannelService {
  constructor(
    private repository: PrismaChannelRepository,
    private events: EventService,
  ) {}

  async createChannel(userId: string, data: CreateChannelDto): Promise<Channel> {
    const channel = await this.repository.create(userId, data);
    
    // Emit channel created event
    this.events.emit(channel.id, 'channel.created', channel);
    
    return channel;
  }

  async updateChannel(userId: string, channelId: string, data: UpdateChannelDto): Promise<Channel> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.repository.findMember(channelId, userId);
    if (!member || member.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only channel owner can update the channel');
    }

    const updated = await this.repository.update(channelId, data);
    
    // Emit channel updated event
    this.events.emit(channelId, 'channel.updated', updated);
    
    return updated;
  }

  async deleteChannel(userId: string, channelId: string): Promise<void> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.repository.findMember(channelId, userId);
    if (!member || member.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only channel owner can delete the channel');
    }

    await this.repository.delete(channelId);
    
    // Emit channel deleted event
    this.events.emit(channelId, 'channel.deleted', { id: channelId });
  }

  async joinChannel(userId: string, channelId: string): Promise<void> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.type !== 'PUBLIC') {
      throw new ForbiddenException('Cannot join private or DM channels directly');
    }

    const member = await this.repository.findMember(channelId, userId);
    if (member) {
      throw new ForbiddenException('Already a member of this channel');
    }

    const newMember = await this.repository.addMember(channelId, userId, MemberRole.MEMBER);
    
    // Emit member joined event
    this.events.emit(channelId, 'channel.member_joined', {
      channelId,
      member: {
        userId,
        channelId,
        role: newMember.role,
        joinedAt: newMember.joinedAt,
      },
    });
  }

  async leaveChannel(userId: string, channelId: string): Promise<void> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.repository.findMember(channelId, userId);
    if (!member) {
      throw new NotFoundException('Not a member of this channel');
    }

    if (member.role === MemberRole.OWNER) {
      throw new ForbiddenException('Channel owner cannot leave the channel');
    }

    await this.repository.removeMember(channelId, userId);
    
    // Emit member left event
    this.events.emit(channelId, 'channel.member_left', {
      channelId,
      userId,
    });
  }

  async getChannels(userId: string, query: ChannelQuery): Promise<Channel[]> {
    return this.repository.findAll(userId, query);
  }

  async getChannel(userId: string, channelId: string): Promise<Channel> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.repository.findMember(channelId, userId);
    if (!member && channel.type !== 'PUBLIC') {
      throw new ForbiddenException('Not authorized to view this channel');
    }

    return channel;
  }

  async getMembers(channelId: string): Promise<ChannelMember[]> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return this.repository.findMembers(channelId);
  }
} 