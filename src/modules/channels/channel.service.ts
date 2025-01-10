import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventService } from '../../core/events/event.service';
import { CreateChannelDto, UpdateChannelDto, ChannelQuery, MemberRole } from './channel.types';
import { PrismaChannelRepository } from './channel.repository';
import { Channel, ChannelMember } from '../../core/events/event.types';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ChannelService {
  constructor(
    private repository: PrismaChannelRepository,
    private events: EventService,
    private prisma: PrismaService,
  ) {}

  async createChannel(userId: string, data: CreateChannelDto, memberIds?: string[]): Promise<Channel> {
    const timestamp = new Date().toISOString();
    console.log('=============== SERVICE CREATE START ===============');
    console.log('STEP 1: Raw Input:', {
      userId,
      data,
      memberIds
    });

    // Extract memberIds from data if it exists there
    const extractedMemberIds = (data as any).memberIds || memberIds || [];
    
    // Create clean data object without memberIds
    const { memberIds: _, ...cleanData } = data as any;

    console.log('STEP 2: Extracted Data:', {
      cleanData,
      extractedMemberIds
    });

    // For private channels, ensure memberIds is provided
    if (cleanData.type === 'PRIVATE' && (!extractedMemberIds.length)) {
      console.error('STEP X: Validation Error - No members for private channel');
      throw new BadRequestException('Private channels must have at least one member besides the owner');
    }

    console.log('STEP 3: Calling Repository:', {
      userId,
      cleanData,
      extractedMemberIds
    });

    // Pass clean data and memberIds to repository
    const channel = await this.repository.create(userId, cleanData, extractedMemberIds);
    
    console.log('STEP 4: Repository Response:', {
      channelId: channel.id,
      type: channel.type,
      memberCount: channel.memberCount
    });

    // For private channels, we need to emit to all members
    if (channel.type === 'PRIVATE') {
      const members = await this.repository.findMembers(channel.id);
      members.forEach(member => {
        this.events.emitToUser(member.userId, 'channel.created', channel);
      });
    } else {
      this.events.emit(channel.id, 'channel.created', channel);
    }
    
    console.log('=============== SERVICE CREATE END ===============');
    return channel;
  }

  async updateChannel(userId: string, channelId: string, data: UpdateChannelDto): Promise<Channel> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.repository.findMember(channelId, userId);
    if (!member || member.role !== 'OWNER') {
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
    if (!member || member.role !== 'OWNER') {
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

    const newMember = await this.repository.addMember(channelId, userId, 'MEMBER');
    
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

  async leaveChannel(userId: string, channelId: string, shouldDelete: boolean = false): Promise<void> {
    const channel = await this.repository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.repository.findMember(channelId, userId);
    if (!member) {
      throw new NotFoundException('Not a member of this channel');
    }

    if (member.role === 'OWNER') {
      if (shouldDelete) {
        // Delete the entire channel if owner wants to delete
        await this.deleteChannel(userId, channelId);
        return;
      }

      // Get other members to potentially transfer ownership
      const otherMembers = await this.repository.findMembers(channelId);
      const nonOwnerMembers = otherMembers.filter(m => m.userId !== userId);

      if (nonOwnerMembers.length === 0) {
        // No other members, delete the channel
        await this.deleteChannel(userId, channelId);
        return;
      }

      // Transfer ownership to the next member
      const nextOwner = nonOwnerMembers[0];
      
      // First update the next owner's role to OWNER
      await this.prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId: channelId,
            userId: nextOwner.userId
          }
        },
        data: {
          role: 'OWNER'
        }
      });

      // Then remove the old owner
      await this.repository.removeMember(channelId, userId);
    }
    else {
      await this.repository.removeMember(channelId, userId);
    }
    
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