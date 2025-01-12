import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelQuery } from '../types/channel.types';
import { ChannelType } from '@prisma/client';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async getChannels(userId: string, query: ChannelQuery) {
    return this.prisma.channel.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
        ...(query.type && { type: query.type }),
      },
      include: {
        members: true,
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
    });
  }

  async getChannel(userId: string, channelId: string) {
    return this.prisma.channel.findFirst({
      where: {
        id: channelId,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: true,
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
    });
  }

  async createChannel(userId: string, createChannelDto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: {
        name: createChannelDto.name,
        description: createChannelDto.description,
        type: createChannelDto.type,
        createdById: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  async updateChannel(userId: string, channelId: string, updateChannelDto: UpdateChannelDto) {
    // Verify user has permission to update channel
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        members: {
          some: {
            userId,
            role: {
              in: ['OWNER', 'ADMIN'],
            },
          },
        },
      },
    });

    if (!channel) {
      throw new Error('Channel not found or insufficient permissions');
    }

    return this.prisma.channel.update({
      where: { id: channelId },
      data: updateChannelDto,
      include: {
        members: true,
      },
    });
  }

  async removeMember(userId: string, channelId: string) {
    // First check if user is in the channel
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      include: {
        channel: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!membership) {
      throw new Error('User is not a member of this channel');
    }

    // If user is the owner and there are other members, they can't leave
    if (
      membership.role === 'OWNER' && 
      membership.channel.members.length > 1
    ) {
      throw new Error('Channel owner cannot leave while other members exist');
    }

    // Remove the member
    await this.prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    // If this was the last member, delete the channel
    if (membership.channel.members.length === 1) {
      await this.deleteChannel(userId, channelId);
      return { wasDeleted: true };
    }

    return { wasDeleted: false };
  }

  async deleteChannel(userId: string, channelId: string) {
    // Verify user has permission to delete channel
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        members: {
          some: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });

    if (!channel) {
      throw new Error('Channel not found or insufficient permissions');
    }

    // Delete all messages first (if we need to maintain referential integrity)
    await this.prisma.message.deleteMany({
      where: { channelId },
    });

    // Delete all channel members
    await this.prisma.channelMember.deleteMany({
      where: { channelId },
    });

    // Finally delete the channel
    await this.prisma.channel.delete({
      where: { id: channelId },
    });
  }
} 