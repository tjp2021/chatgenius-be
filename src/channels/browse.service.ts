import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelType, MemberRole } from '@prisma/client';
import { ChannelsService } from './channels.service';
import {
  PublicChannelsResponse,
  JoinedChannelsResponse,
  ChannelJoinResponse,
  ChannelLeaveResponse,
  ChannelMembersResponse,
  BrowseOptions,
  ChannelSortBy,
  SortOrder
} from './dto/channel-browse.dto';

@Injectable()
export class BrowseService {
  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  async getPublicChannels(
    userId: string,
    options: BrowseOptions
  ): Promise<PublicChannelsResponse> {
    const { search, sortBy, sortOrder } = options;

    const channels = await this.prisma.channel.findMany({
      where: {
        type: ChannelType.PUBLIC,
        name: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      include: {
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
        members: {
          where: { userId },
          select: { joinedAt: true },
        },
      },
      orderBy: this.getOrderByClause(sortBy, sortOrder),
    });

    return {
      channels: channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        _count: {
          members: channel._count.members,
          messages: channel._count.messages,
        },
        createdAt: channel.createdAt.toISOString(),
        isMember: channel.members.length > 0,
        joinedAt: channel.members[0]?.joinedAt.toISOString(),
      })),
    };
  }

  async getJoinedChannels(
    userId: string,
    options: BrowseOptions
  ): Promise<JoinedChannelsResponse> {
    const { search, sortBy, sortOrder } = options;

    const channels = await this.prisma.channel.findMany({
      where: {
        members: {
          some: { userId },
        },
        name: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      include: {
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
        members: {
          where: { userId },
          select: { 
            joinedAt: true,
            role: true  // Add role to select
          },
        },
      },
      orderBy: this.getOrderByClause(sortBy, sortOrder),
    });

    return {
      channels: channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        _count: {
          members: channel._count.members,
          messages: channel._count.messages,
        },
        createdAt: channel.createdAt.toISOString(),
        joinedAt: channel.members[0].joinedAt.toISOString(),
        isOwner: channel.members[0].role === MemberRole.OWNER,  // Add isOwner field
      })),
    };
  }

  async joinChannel(userId: string, channelId: string): Promise<ChannelJoinResponse> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.type !== ChannelType.PUBLIC) {
      throw new ForbiddenException('Only public channels can be joined directly');
    }

    if (channel.members.length > 0) {
      throw new ForbiddenException('Already a member of this channel');
    }

    await this.prisma.channelMember.create({
      data: {
        userId,
        channelId,
        role: MemberRole.MEMBER,
      },
    });

    return {
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
      },
    };
  }

  async leaveChannel(userId: string, channelId: string): Promise<ChannelLeaveResponse> {
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
   });

    if (!membership) {
      throw new NotFoundException('Not a member of this channel');
    }

    await this.channelsService.leave(userId, channelId, false);
    return { success: true };
  }

  async getChannelMembers(userId: string, channelId: string): Promise<ChannelMembersResponse> {
    // First verify user has access to the channel
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.type !== ChannelType.PUBLIC && !channel.members.length) {
      throw new ForbiddenException('Not authorized to view channel members');
    }

    // Get all members with their user info
    const members = await this.prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            isOnline: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });

    return {
      members: members.map(member => ({
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        user: {
          id: member.user.id,
          name: member.user.name,
          imageUrl: member.user.imageUrl,
          isOnline: member.user.isOnline,
        },
      })),
      _count: {
        total: members.length,
      },
    };
  }

  private getOrderByClause(sortBy?: ChannelSortBy, sortOrder: SortOrder = 'desc') {
    switch (sortBy) {
      case 'memberCount':
        return { members: { _count: sortOrder } };
      case 'messages':
        return { messages: { _count: sortOrder } };
      case 'name':
        return { name: sortOrder };
      case 'joinedAt':
        return { members: { joinedAt: sortOrder } };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }
} 