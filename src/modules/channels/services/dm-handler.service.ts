import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisCacheService } from '../../../core/cache/redis.service';
import { EventService } from '../../../core/events/event.service';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { NetworkConnectivityException } from '../errors/network-connectivity.exception';
import { Prisma } from '@prisma/client';
import {
  DMTypingStatus,
  DMTypingEvent,
  DMReadReceipt,
  DMReadReceiptEvent,
  DMThread,
  DMThreadMessage,
  EnrichedDMChannel,
  DMParticipantStatus
} from '../types/dm.types';

@Injectable()
export class DMHandlerService {
  private readonly logger = new Logger(DMHandlerService.name);
  private readonly TYPING_TIMEOUT = 5000; // 5 seconds

  constructor(
    private prisma: PrismaService,
    private cacheService: RedisCacheService,
  ) {}

  private async generateDMName(userId: string, targetUserId: string): Promise<string> {
    try {
      const [user1, user2] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true }
        }),
        this.prisma.user.findUnique({
          where: { id: targetUserId },
          select: { name: true }
        })
      ]);

      if (!user2) {
        throw new NotFoundException('Target user not found');
      }

      // Use names if available, fallback to IDs
      const name1 = user1?.name || userId;
      const name2 = user2?.name || targetUserId;

      // Sort names to ensure consistent naming regardless of who initiates
      const sortedNames = [name1, name2].sort();
      return `${sortedNames[0]} & ${sortedNames[1]}`;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Fallback to basic name if error occurs
      return `dm-${userId}-${targetUserId}`;
    }
  }

  async findExistingDM(userId: string, targetUserId: string): Promise<EnrichedDMChannel | null> {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot create DM with yourself');
    }

    const channel = await this.prisma.channel.findFirst({
      where: {
        type: 'DM',
        AND: [
          {
            members: {
              some: {
                userId
              }
            }
          },
          {
            members: {
              some: {
                userId: targetUserId
              }
            }
          }
        ]
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!channel) {
      return null;
    }

    return this.enrichDMData(channel);
  }

  async create(userId: string, dto: CreateChannelDto) {
    if (!dto.targetUserId) {
      throw new BadRequestException('targetUserId is required for DM channels');
    }

    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot create DM with yourself');
    }

    // Check if target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId }
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Check if DM already exists
    const existingDM = await this.findExistingDM(userId, dto.targetUserId);
    if (existingDM) {
      return this.enrichDMData(existingDM);
    }

    // Generate DM name
    const dmName = await this.generateDMName(userId, dto.targetUserId);

    try {
      const channel = await this.prisma.channel.create({
        data: {
          name: dmName,
          type: 'DM',
          createdById: userId,
          members: {
            create: [
              {
                userId: userId,
                role: 'MEMBER',
              },
              {
                userId: dto.targetUserId,
                role: 'MEMBER',
              }
            ],
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

      // Cache invalidation
      await Promise.all([
        this.cacheService.invalidateChannelList(userId),
        this.cacheService.invalidateChannelList(dto.targetUserId),
      ]);

      return this.enrichDMData(channel);
    } catch (error) {
      this.logger.error('Failed to create DM channel:', error);
      if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
        throw new NetworkConnectivityException();
      }
      throw error;
    }
  }

  async getDMParticipantStatus(channelId: string): Promise<DMParticipantStatus> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                isOnline: true,
                updatedAt: true,
              }
            }
          }
        }
      }
    });

    if (!channel || channel.type !== 'DM') {
      throw new NotFoundException('DM channel not found');
    }

    return {
      participants: channel.members.map(member => ({
        userId: member.userId,
        isOnline: member.user.isOnline,
        lastSeen: member.user.updatedAt
      }))
    };
  }

  async enrichDMData(channelData: any): Promise<EnrichedDMChannel> {
    const channelWithMembers = await this.prisma.channel.findUnique({
      where: { id: channelData.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                isOnline: true,
                updatedAt: true,
              }
            }
          }
        }
      }
    });

    if (!channelWithMembers) {
      throw new NotFoundException('Channel not found');
    }

    const [lastMessage, participantStatus] = await Promise.all([
      this.prisma.message.findFirst({
        where: { channelId: channelData.id },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            }
          }
        }
      }),
      this.getDMParticipantStatus(channelData.id)
    ]);

    // Map the data to match our types
    const enrichedChannel: EnrichedDMChannel = {
      id: channelWithMembers.id,
      name: channelWithMembers.name,
      type: 'DM',
      createdAt: channelWithMembers.createdAt,
      updatedAt: channelWithMembers.updatedAt,
      unreadCount: 0, // This should be calculated based on read receipts
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        content: lastMessage.content,
        createdAt: lastMessage.createdAt,
        user: lastMessage.user
      } : null,
      participants: participantStatus.participants.map(p => ({
        id: p.userId,
        name: p.userId,
        imageUrl: null,
        status: p.isOnline ? 'online' : 'offline'
      })),
    };

    return enrichedChannel;
  }

  async getDMChannels(userId: string): Promise<EnrichedDMChannel[]> {
    const channels = await this.prisma.channel.findMany({
      where: {
        type: 'DM',
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        lastActivityAt: 'desc'
      }
    });

    // Enrich with last message and participant status data
    const enrichedChannels = await Promise.all(
      channels.map(channel => this.enrichDMData(channel))
    );

    return enrichedChannels;
  }

  private getTypingCacheKey(channelId: string): string {
    return `typing:${channelId}`;
  }

  async setTypingStatus(channelId: string, userId: string, isTyping: boolean): Promise<DMTypingEvent> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { userId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    if (!channel || channel.type !== 'DM') {
      throw new NotFoundException('DM channel not found');
    }

    if (!channel.members.length) {
      throw new BadRequestException('Not a member of this DM');
    }

    const typingEvent: DMTypingEvent = {
      userId,
      channelId,
      isTyping
    };

    // Store typing status in cache with expiration
    if (isTyping) {
      await this.cacheService.setTypingStatus(channelId, {
        userId,
        channelId,
        isTyping,
        timestamp: new Date()
      });
    } else {
      await this.cacheService.invalidateTypingStatus(channelId);
    }

    return typingEvent;
  }

  async getTypingStatus(channelId: string): Promise<DMTypingStatus | null> {
    const status = await this.cacheService.getTypingStatus(channelId);

    if (!status) {
      return null;
    }

    // Check if status is still valid
    const now = new Date();
    const timestamp = new Date(status.timestamp);
    if (now.getTime() - timestamp.getTime() > this.TYPING_TIMEOUT) {
      await this.cacheService.invalidateTypingStatus(channelId);
      return null;
    }

    return status;
  }

  async markMessageAsRead(channelId: string, messageId: string, userId: string): Promise<DMReadReceiptEvent> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { userId },
          include: {
            user: true
          }
        }
      }
    });

    if (!channel || channel.type !== 'DM') {
      throw new NotFoundException('DM channel not found');
    }

    if (!channel.members.length) {
      throw new BadRequestException('Not a member of this DM');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found in this channel');
    }

    // Update the member's last read timestamp and unread count
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

    const readReceiptEvent: DMReadReceiptEvent = {
      userId,
      channelId,
      messageId,
      readAt: new Date()
    };

    return readReceiptEvent;
  }

  async getReadReceipts(channelId: string, messageId: string): Promise<DMReadReceipt[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          include: {
            members: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!message || message.channel.type !== 'DM') {
      throw new NotFoundException('Message not found in DM channel');
    }

    const readReceipts = message.channel.members
      .filter(member => member.lastReadAt && member.lastReadAt >= message.createdAt)
      .map(member => ({
        messageId,
        channelId,
        userId: member.userId,
        readAt: member.lastReadAt!
      }));

    return readReceipts;
  }

  async getMessageThread(channelId: string, messageId: string): Promise<DMThread> {
    const parentMessage = await this.prisma.message.findUnique({
      where: { 
        id: messageId,
        channelId 
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          }
        }
      }
    });

    if (!parentMessage) {
      throw new NotFoundException('Parent message not found');
    }

    const replies = await this.prisma.message.findMany({
      where: {
        replyToId: messageId,
        channelId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Get unique participant count
    const participants = new Set(
      [parentMessage, ...replies].map(msg => msg.userId)
    );

    const lastReply = replies[replies.length - 1];

    const thread: DMThread = {
      id: messageId,
      channelId,
      parentMessageId: messageId,
      messages: replies.map(reply => ({
        id: reply.id,
        content: reply.content,
        threadId: messageId,
        userId: reply.userId,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        thread: null // Avoid circular reference
      })),
      createdAt: parentMessage.createdAt,
      updatedAt: new Date()
    };

    return thread;
  }

  async getThreadedMessages(channelId: string): Promise<DMThreadMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        replyToId: { not: null }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          }
        },
        _count: {
          select: {
            replies: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return messages.map(msg => ({
      id: msg.id,
      threadId: msg.channelId,
      userId: msg.userId,
      content: msg.content,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      thread: {
        id: msg.channelId,
        channelId: msg.channelId,
        parentMessageId: msg.replyToId || '',
        messages: [],
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt
      }
    }));
  }
} 