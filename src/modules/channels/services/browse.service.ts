import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ChannelType, MemberRole } from '../../../shared/types/prisma.types';
import { Prisma } from '@prisma/client';
import { ChannelService } from '../channel.service';
import { RedisCacheService } from '../../../core/cache/redis.service';
import { NetworkConnectivityException } from '../errors/network-connectivity.exception';
import {
  PublicChannelsResponse,
  JoinedChannelsResponse,
  ChannelJoinResponse,
  ChannelLeaveResponse,
  ChannelMembersResponse,
  BrowseOptions,
  ChannelSortBy,
  SortOrder
} from '../dto/channel-browse.dto';

@Injectable()
export class BrowseService {
  constructor(
    private prisma: PrismaService,
    private channelService: ChannelService,
    private cacheService: RedisCacheService,
  ) {}

  async getPublicChannels(
    userId: string,
    options: BrowseOptions
  ): Promise<PublicChannelsResponse> {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const { search, sortBy, sortOrder } = options;
    console.log('Getting public channels with options:', { userId, search, sortBy, sortOrder });

    try {
      // First, get unique channel IDs where user is a member
      const memberChannelIds = await this.prisma.channelMember
        .findMany({
          where: { userId },
          select: { channelId: true }
        })
        .then(members => [...new Set(members.map(m => m.channelId))]);

      console.log('User member channel IDs:', memberChannelIds);

      // Then get all public channels excluding those IDs
      const channels = await this.prisma.channel.findMany({
        where: {
          type: ChannelType.PUBLIC,
          id: { notIn: memberChannelIds },
          ...(search ? {
            name: { contains: search, mode: 'insensitive' }
          } : {})
        },
        include: {
          _count: {
            select: {
              members: true,
              messages: true,
            },
          }
        },
        orderBy: { createdAt: sortOrder || 'desc' }
      });

      console.log('Found public channels:', channels.length, channels.map(c => ({ id: c.id, name: c.name })));

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
          isMember: false,
          joinedAt: null,
        })),
      };
    } catch (error) {
      console.error('Error in getPublicChannels:', error);
      throw error;
    }
  }

  async getJoinedChannels(
    userId: string,
    options: BrowseOptions
  ): Promise<JoinedChannelsResponse> {
    if (!userId) {
      throw new Error('userId is required');
    }

    const { search, sortBy, sortOrder } = options;
    console.log('Getting joined channels with options:', { userId, search, sortBy, sortOrder });

    try {
      // Get all channels where user is a member, using distinct to avoid duplicates
      const memberChannels = await this.prisma.channelMember.findMany({
        where: { 
          userId,
          ...(search ? {
            channel: {
              name: { contains: search, mode: 'insensitive' }
            }
          } : {})
        },
        include: {
          channel: {
            include: {
              _count: {
                select: {
                  members: true,
                  messages: true,
                }
              }
            }
          }
        },
        orderBy: {
          ...(sortBy === 'createdAt' ? { channel: { createdAt: sortOrder || 'desc' } } :
            sortBy === 'name' ? { channel: { name: sortOrder || 'desc' } } :
            sortBy === 'memberCount' ? { channel: { memberCount: sortOrder || 'desc' } } :
            { joinedAt: sortOrder || 'desc' })
        },
        distinct: ['channelId']  // Add distinct constraint
      });

      console.log('Found member channels:', memberChannels.length, memberChannels.map(mc => ({ 
        id: mc.channel.id, 
        name: mc.channel.name,
        role: mc.role,
        joinedAt: mc.joinedAt
      })));

      return {
        channels: memberChannels.map(mc => ({
          id: mc.channel.id,
          name: mc.channel.name,
          description: mc.channel.description,
          type: mc.channel.type,
          _count: {
            members: mc.channel._count.members,
            messages: mc.channel._count.messages,
          },
          createdAt: mc.channel.createdAt.toISOString(),
          joinedAt: mc.joinedAt.toISOString(),
          isOwner: mc.role === MemberRole.OWNER,
        })),
      };
    } catch (error) {
      console.error('Error in getJoinedChannels:', error);
      throw error;
    }
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

    try {
      // Use transaction for atomic updates
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create member
        await prisma.channelMember.create({
          data: {
            userId,
            channelId,
            role: MemberRole.MEMBER,
          },
        });

        // Update channel member count
        const updatedChannel = await prisma.channel.update({
          where: { id: channelId },
          data: {
            memberCount: {
              increment: 1
            }
          },
          select: {
            id: true,
            name: true,
            type: true,
          }
        });

        return updatedChannel;
      });

      // Invalidate all relevant caches
      await Promise.all([
        this.cacheService.invalidateChannelMembership(userId, channelId),
        this.cacheService.invalidateChannelList(userId),
        this.cacheService.invalidateChannelActivity(channelId)
      ]);

      return {
        success: true,
        channel: result
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async leaveChannel(userId: string, channelId: string): Promise<ChannelLeaveResponse> {
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      include: {
        channel: true
      }
    });

    if (!membership) {
      throw new NotFoundException('Not a member of this channel');
    }

    try {
      // Use transaction for atomic updates
      await this.prisma.$transaction(async (prisma) => {
        // Delete membership
        await prisma.channelMember.delete({
          where: {
            channelId_userId: {
              channelId,
              userId,
            },
          },
        });

        // Update channel member count
        await prisma.channel.update({
          where: { id: channelId },
          data: {
            memberCount: {
              decrement: 1
            }
          }
        });
      });

      // Invalidate all relevant caches
      await Promise.all([
        this.cacheService.invalidateChannelMembership(userId, channelId),
        this.cacheService.invalidateChannelList(userId),
        this.cacheService.invalidateChannelActivity(channelId)
      ]);

      return { success: true };
    } catch (error) {
      console.error('Error in leaveChannel:', error);
      throw error;
    }
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
    console.log('Generating order by clause:', { sortBy, sortOrder });
    
    switch (sortBy) {
      case 'memberCount':
        return { memberCount: sortOrder };
      case 'messages':
        return { 
          _count: {
            messages: sortOrder 
          }
        };
      case 'name':
        return { name: sortOrder };
      case 'joinedAt':
        return { 
          members: {
            _count: sortOrder
          }
        };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }
} 