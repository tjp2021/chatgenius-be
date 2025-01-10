import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ChannelRepository, CreateChannelDto, UpdateChannelDto, ChannelQuery } from './channel.types';
import { Channel, ChannelMember } from '../../core/events/event.types';
import { ChannelType, MemberRole } from '@prisma/client';

@Injectable()
export class PrismaChannelRepository implements ChannelRepository {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: CreateChannelDto): Promise<Channel> {
    const channelData = {
      ...data,
      type: data.type || ChannelType.PUBLIC,
    };

    return this.prisma.channel.create({
      data: {
        ...channelData,
        createdById: userId,
        members: {
          create: {
            userId,
            role: MemberRole.OWNER,
          },
        },
      },
      include: {
        members: true,
        createdBy: true,
      },
    });
  }

  async update(channelId: string, data: UpdateChannelDto): Promise<Channel> {
    return this.prisma.channel.update({
      where: { id: channelId },
      data,
      include: {
        members: true,
        createdBy: true,
      },
    });
  }

  async delete(channelId: string): Promise<void> {
    await this.prisma.channel.delete({
      where: { id: channelId },
    });
  }

  async findById(channelId: string): Promise<Channel | null> {
    return this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: true,
        createdBy: true,
      },
    });
  }

  async findAll(userId: string, query: ChannelQuery): Promise<Channel[]> {
    const { type, search, cursor, limit = 20 } = query;

    console.log('🔍 Finding channels for user:', { 
      userId,
      query,
      timestamp: new Date().toISOString()
    });

    return this.prisma.channel.findMany({
      where: {
        OR: [
          {
            type: "PUBLIC",
            members: {
              none: {
                userId: userId
              }
            }
          },
          {
            members: {
              some: {
                userId: userId
              }
            }
          }
        ],
        ...(search && {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        }),
        ...(type && { type })
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: {
          id: cursor
        }
      }),
      orderBy: {
        lastActivityAt: "desc"
      },
      include: {
        members: true,
        createdBy: true
      }
    });
  }

  async findMember(channelId: string, userId: string): Promise<ChannelMember | null> {
    return this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });
  }

  async findMembers(channelId: string): Promise<ChannelMember[]> {
    return this.prisma.channelMember.findMany({
      where: {
        channelId,
      },
      include: {
        user: true,
      },
    });
  }

  async addMember(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember> {
    return this.prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role,
      },
    });
  }

  async removeMember(channelId: string, userId: string): Promise<void> {
    await this.prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });
  }
} 