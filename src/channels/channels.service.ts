import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { Channel, ChannelType, MemberRole, Prisma, ChannelMember, User } from '@prisma/client';
import { NavigationTarget } from './types';
import { RedisCacheService } from '../cache/redis.service';
import {
  ChannelAccessDeniedException,
  ChannelNotFoundException,
  ChannelDeletedException,
  ChannelTransitionFailedException,
  NetworkConnectivityException,
  ChannelCapacityException,
  TransitionError
} from './errors';
import { ChannelMetadataDto } from './dto/channel-metadata.dto';

const MAX_CHANNEL_MEMBERS = 1000;
const MAX_TRANSITION_ATTEMPTS = 3;
const TRANSITION_RETRY_DELAY = 1000; // 1 second

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  private transitionErrors = new Map<string, TransitionError>();

  constructor(
    private prisma: PrismaService,
    private cacheService: RedisCacheService,
  ) {}

  private async validateChannelAccess(channelId: string, userId: string): Promise<Channel & { members: (ChannelMember & { user: User })[] }> {
    try {
      // Try cache first
      const cachedMembership = await this.cacheService.getChannelMembership(userId, channelId);
      if (cachedMembership) {
        return cachedMembership as Channel & { members: (ChannelMember & { user: User })[] };
      }

      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          members: {
            include: {
              user: true
            }
          }
        },
      }) as Channel & { members: (ChannelMember & { user: User })[] };

      if (!channel) {
        // Check if channel was deleted
        const deletedChannel = await this.prisma.channel.findUnique({
          where: { id: channelId },
          include: { 
            members: {
              include: {
                user: true
              }
            }
          },
        });

        if (deletedChannel === null) {
          throw new ChannelDeletedException();
        }
        throw new ChannelNotFoundException();
      }

      if (channel.type !== ChannelType.PUBLIC) {
        const isMember = channel.members.some(member => member.userId === userId);
        if (!isMember) {
          throw new ChannelAccessDeniedException();
        }
      }

      // Cache the result
      await this.cacheService.setChannelMembership(userId, channelId, channel);
      return channel;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async handleChannelTransition(
    userId: string, 
    fromChannelId: string,
    attemptCount: number = 1
  ): Promise<NavigationTarget | null> {
    try {
      // Check previous transition errors
      const previousError = this.transitionErrors.get(`${userId}:${fromChannelId}`);
      if (previousError && previousError.attemptCount >= MAX_TRANSITION_ATTEMPTS) {
        throw new ChannelTransitionFailedException(
          'Maximum transition attempts reached',
          0,
          0
        );
      }

      const currentChannel = await this.validateChannelAccess(fromChannelId, userId);
      if (!currentChannel) {
        return this.getNavigationTarget(userId);
      }

      // Follow transition rules based on channel type
      const nextChannel = await this.findNextChannel(userId, fromChannelId, currentChannel.type);
      
      if (nextChannel) {
        // Clear any previous errors on success
        this.transitionErrors.delete(`${userId}:${fromChannelId}`);
        return nextChannel;
      }

      return null; // No channels left, should show welcome screen

    } catch (error) {
      // Handle transition errors
      if (attemptCount < MAX_TRANSITION_ATTEMPTS) {
        this.logger.warn(`Channel transition failed, attempt ${attemptCount} of ${MAX_TRANSITION_ATTEMPTS}`);
        
        // Record the error
        this.transitionErrors.set(`${userId}:${fromChannelId}`, {
          channelId: fromChannelId,
          error: error.message,
          timestamp: new Date(),
          attemptCount,
          lastAttempt: new Date(),
        });

        // Retry after delay
        await new Promise(resolve => setTimeout(resolve, TRANSITION_RETRY_DELAY));
        return this.handleChannelTransition(userId, fromChannelId, attemptCount + 1);
      }

      throw new ChannelTransitionFailedException(
        'Failed to transition after maximum attempts',
        TRANSITION_RETRY_DELAY,
        0
      );
    }
  }

  private async findNextChannel(
    userId: string,
    currentChannelId: string,
    currentType: ChannelType
  ): Promise<NavigationTarget | null> {
    // Try to find next channel based on priority
    const types = [ChannelType.PUBLIC, ChannelType.PRIVATE, ChannelType.DM];
    const startIndex = types.indexOf(currentType);

    for (let i = startIndex; i < types.length; i++) {
      const nextChannel = await this.prisma.channelMember.findFirst({
        where: {
          userId,
          channel: {
            type: types[i],
            id: { not: currentChannelId }
          }
        },
        select: {
          channelId: true,
          lastReadAt: true,
          unreadCount: true,
          channel: {
            select: {
              type: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      if (nextChannel?.channel) {
        return {
          channelId: nextChannel.channelId,
          type: nextChannel.channel.type,
          lastViewedAt: nextChannel.lastReadAt || new Date(),
          unreadState: nextChannel.unreadCount > 0
        };
      }
    }

    return null;
  }

  async join(userId: string, channelId: string) {
    const channel = await this.validateChannelAccess(channelId, userId);

    if (channel.type !== ChannelType.PUBLIC) {
      throw new ChannelAccessDeniedException('Cannot join private or DM channels directly');
    }

    // Check member count
    const memberCount = await this.prisma.channelMember.count({
      where: { channelId }
    });

    if (memberCount >= MAX_CHANNEL_MEMBERS) {
      throw new ChannelCapacityException();
    }

    const isMember = channel.members.some(member => member.userId === userId);
    if (isMember) {
      throw new ChannelAccessDeniedException('Already a member of this channel');
    }

    try {
      const result = await this.prisma.channelMember.create({
        data: {
          channelId,
          userId,
          role: MemberRole.MEMBER,
        },
        include: {
          channel: true,
          user: true,
        },
      });

      // Update cache
      await this.cacheService.invalidateChannelMembership(userId, channelId);
      await this.cacheService.invalidateChannelActivity(channelId);

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async create(userId: string, dto: CreateChannelDto) {
    const channel = await this.prisma.channel.create({
      data: {
        ...dto,
        createdById: userId,
        members: {
          create: {
            userId,
            role: MemberRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return channel;
  }

  async findAll(userId: string, query?: {
    search?: string;
    sortBy?: 'memberCount' | 'messages' | 'createdAt' | 'name' | 'lastActivity';
    sortOrder?: 'asc' | 'desc';
    type?: ChannelType;
  }) {
    try {
      this.logger.log('Starting findAll channels request', { userId, query });
      
      // Try cache first
      const cachedChannels = await this.cacheService.getCachedChannelList(userId);
      if (cachedChannels && !query) {
        this.logger.log('Returning cached channels');
        return cachedChannels;
      }

      type ChannelWithStats = {
        id: string;
        name: string;
        description: string | null;
        type: ChannelType;
        createdById: string;
        createdAt: Date;
        lastActivityAt: Date;
        memberCount: number;
        messageCount: number;
        unreadCount: number;
        lastReadAt: Date | null;
        isMember: boolean;
      };

      const channels = await this.prisma.channel.findMany({
        where: {
          members: {
            some: {
              userId
            }
          },
          ...(query?.type ? { type: query.type } : {}),
          ...(query?.search ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } }
            ]
          } : {})
        },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          createdById: true,
          createdAt: true,
          lastActivityAt: true,
          memberCount: true,
          _count: {
            select: {
              messages: true,
              members: true
            }
          },
          members: {
            where: {
              userId
            },
            select: {
              lastReadAt: true,
              unreadCount: true
            }
          }
        },
        orderBy: query?.sortBy === 'messages' 
          ? { messages: { _count: query.sortOrder || 'desc' } }
          : query?.sortBy === 'memberCount'
          ? { members: { _count: query.sortOrder || 'desc' } }
          : query?.sortBy === 'lastActivity'
          ? { lastActivityAt: query.sortOrder || 'desc' }
          : query?.sortBy === 'name'
          ? { name: query.sortOrder || 'desc' }
          : query?.sortBy === 'createdAt'
          ? { createdAt: query.sortOrder || 'desc' }
          : undefined
      });

      this.logger.debug('Raw query result:', { 
        channelCount: channels.length,
        firstChannel: channels[0] 
      });

      const transformedChannels: ChannelWithStats[] = channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        createdById: channel.createdById,
        createdAt: channel.createdAt,
        lastActivityAt: channel.lastActivityAt,
        messageCount: channel._count.messages,
        memberCount: channel.memberCount,
        unreadCount: channel.members[0]?.unreadCount ?? 0,
        lastReadAt: channel.members[0]?.lastReadAt ?? null,
        isMember: channel.members.length > 0
      }));

      this.logger.debug('Transformed channels:', { 
        channelCount: transformedChannels.length,
        firstChannel: transformedChannels[0]
      });

      // Cache the results if no query parameters
      if (!query) {
        await this.cacheService.cacheChannelList(userId, transformedChannels);
      }

      return transformedChannels;
    } catch (error) {
      this.logger.error('Error in findAll:', { 
        error: error.message, 
        stack: error.stack,
        userId,
        query,
        errorType: error.constructor.name,
        prismaError: error instanceof Prisma.PrismaClientKnownRequestError ? {
          code: error.code,
          meta: error.meta,
          clientVersion: error.clientVersion
        } : undefined
      });
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async findOne(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        messages: {
          take: 50,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: true,
          },
        },
      },
    }) as Channel & { members: (ChannelMember & { user: User })[] };

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.type !== ChannelType.PUBLIC) {
      const isMember = channel.members.some(member => member.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('Not a member of this channel');
      }
    }

    return channel;
  }

  async leave(userId: string, channelId: string, shouldDelete: boolean = false) {
    this.logger.debug(`Attempting to leave channel. UserId: ${userId}, ChannelId: ${channelId}, ShouldDelete: ${shouldDelete}`);
    
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: true
          }
        },
      },
    });

    if (!channel) {
      this.logger.error(`Channel not found: ${channelId}`);
      throw new NotFoundException('Channel not found');
    }

    const member = channel.members.find(m => m.userId === userId);
    if (!member) {
      // If not a member, we're already "left" - return success
      this.logger.debug(`User ${userId} is not a member of channel ${channelId} - already left`);
      return { nextChannel: null };
    }

    const isOwner = member.role === MemberRole.OWNER;

    // Get next channel before removing membership
    const nextChannel = await this.handleChannelTransition(userId, channelId);

    try {
      if (isOwner && shouldDelete) {
        // Delete the entire channel and all its members
        await this.prisma.channel.delete({
          where: { id: channelId },
        });
        this.logger.debug(`Channel ${channelId} deleted by owner ${userId}`);
      } else if (isOwner) {
        // Transfer ownership to the next member or delete if no other members
        const nextOwner = channel.members.find(m => m.userId !== userId);
        
        if (nextOwner) {
          await this.prisma.$transaction([
            // Update current owner to regular member
            this.prisma.channelMember.update({
              where: {
                channelId_userId: { channelId, userId }
              },
              data: { role: MemberRole.MEMBER }
            }),
            // Promote next member to owner
            this.prisma.channelMember.update({
              where: {
                channelId_userId: { channelId, userId: nextOwner.userId }
              },
              data: { role: MemberRole.OWNER }
            })
          ]);
          this.logger.debug(`Ownership transferred from ${userId} to ${nextOwner.userId} for channel ${channelId}`);
        } else {
          // No other members, delete the channel
          await this.prisma.channel.delete({
            where: { id: channelId },
          });
          this.logger.debug(`Channel ${channelId} deleted as owner ${userId} was the last member`);
        }
      } else {
        // Regular member leaving
        await this.prisma.$transaction([
          this.prisma.channelMember.delete({
            where: {
              channelId_userId: {
                channelId,
                userId,
              },
            },
          }),
          this.prisma.$executeRaw`
            UPDATE channels 
            SET "memberCount" = "memberCount" - 1 
            WHERE id = ${channelId}
          `
        ]);
      }
      
      this.logger.debug(`Successfully processed leave request for user ${userId} from channel ${channelId}`);
    } catch (error) {
      this.logger.error(`Failed to process leave request for user ${userId} from channel ${channelId}:`, error);
      throw error;
    }

    return { nextChannel };
  }

  async getNavigationTarget(userId: string): Promise<NavigationTarget | null> {
    // First try to find a public channel
    const publicChannel = await this.prisma.channelMember.findFirst({
      where: {
        userId,
        channel: {
          type: ChannelType.PUBLIC
        }
      },
      select: {
        channelId: true,
        lastReadAt: true,
        unreadCount: true,
        channel: {
          select: {
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (publicChannel?.channel) {
      return {
        channelId: publicChannel.channelId,
        type: publicChannel.channel.type,
        lastViewedAt: publicChannel.lastReadAt || new Date(),
        unreadState: publicChannel.unreadCount > 0
      };
    }

    // Then try private channel
    const privateChannel = await this.prisma.channelMember.findFirst({
      where: {
        userId,
        channel: {
          type: ChannelType.PRIVATE
        }
      },
      select: {
        channelId: true,
        lastReadAt: true,
        unreadCount: true,
        channel: {
          select: {
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (privateChannel?.channel) {
      return {
        channelId: privateChannel.channelId,
        type: privateChannel.channel.type,
        lastViewedAt: privateChannel.lastReadAt || new Date(),
        unreadState: privateChannel.unreadCount > 0
      };
    }

    // Finally, try DM
    const dmChannel = await this.prisma.channelMember.findFirst({
      where: {
        userId,
        channel: {
          type: ChannelType.DM
        }
      },
      select: {
        channelId: true,
        lastReadAt: true,
        unreadCount: true,
        channel: {
          select: {
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (dmChannel?.channel) {
      return {
        channelId: dmChannel.channelId,
        type: dmChannel.channel.type,
        lastViewedAt: dmChannel.lastReadAt || new Date(),
        unreadState: dmChannel.unreadCount > 0
      };
    }

    return null;
  }

  async updateNavigationHistory(userId: string, channelId: string): Promise<void> {
    // Get the highest order
    const lastNavigation = await this.prisma.channelNavigation.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    const nextOrder = (lastNavigation?.order ?? 0) + 1;

    // Keep only last 10 entries and add new entry in a transaction
    await this.prisma.$transaction([
      // Delete old entries
      this.prisma.channelNavigation.deleteMany({
        where: {
          userId,
          order: { lte: nextOrder - 10 }
        }
      }),
      // Add new entry
      this.prisma.channelNavigation.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          channelId,
          order: nextOrder,
          viewedAt: new Date()
        }
      })
    ]);
  }

  async updateLastActivity(channelId: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        // Update channel's last activity
        this.prisma.channel.update({
          where: { id: channelId },
          data: { lastActivityAt: new Date() }
        }),
        // Increment unread count for all members except the sender
        this.prisma.channelMember.updateMany({
          where: { channelId },
          data: {
            unreadCount: { increment: 1 }
          }
        })
      ]);

      // Update cache
      const activity = await this.cacheService.getChannelActivity(channelId);
      if (activity) {
        await this.cacheService.setChannelActivity(channelId, {
          ...activity,
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async markChannelAsRead(userId: string, channelId: string): Promise<void> {
    try {
      await this.prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId,
            userId
          }
        },
        data: {
          lastReadAt: new Date(),
          unreadCount: 0
        }
      });

      // Invalidate cache since read status changed
      await this.cacheService.invalidateChannelMembership(userId, channelId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async getUnreadCount(userId: string, channelId: string): Promise<number> {
    try {
      const membership = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId
          }
        },
        select: {
          unreadCount: true
        }
      });

      return membership?.unreadCount ?? 0;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async getChannelActivity(channelId: string): Promise<{ lastActivity: Date; memberCount: number }> {
    try {
      // Try cache first
      const cachedActivity = await this.cacheService.getChannelActivity(channelId);
      if (cachedActivity) {
        return cachedActivity;
      }

      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        select: {
          lastActivityAt: true,
          _count: {
            select: {
              members: true
            }
          }
        }
      });

      if (!channel) {
        throw new ChannelNotFoundException();
      }

      const activity = {
        lastActivity: channel.lastActivityAt,
        memberCount: channel._count.members
      };

      // Cache the result
      await this.cacheService.setChannelActivity(channelId, activity);

      return activity;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async getChannelMetadata(userId: string, channelId: string): Promise<ChannelMetadataDto> {
    // Get channel and membership data
    const channelWithMember = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { userId },
          include: { user: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      },
    });

    if (!channelWithMember || !channelWithMember.members.length) {
      throw new NotFoundException('Channel not found or user is not a member');
    }

    const member = channelWithMember.members[0];
    const lastMessage = channelWithMember.messages[0];

    return {
      name: channelWithMember.name,
      description: channelWithMember.description,
      unreadCount: member.unreadCount,
      memberCount: channelWithMember.memberCount,
      lastMessagePreview: lastMessage?.content?.slice(0, 100),
    };
  }
}