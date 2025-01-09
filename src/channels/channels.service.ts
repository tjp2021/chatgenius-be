import { Injectable, Logger, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { Channel, ChannelType, MemberRole, User, ChannelMember, Prisma } from '@prisma/client';
import { NavigationTarget } from './types';
import { RedisCacheService } from '../cache/redis.service';
import { MessageService } from '../message/message.service';
import { MessageDeliveryStatus } from '../message/dto/message-events.enum';
import { MessageWithRelations, messageWithRelationsInclude } from '../message/types/message.types';
import { MessageGateway } from '../gateways/message.gateway';
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
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => MessageService))
    private messageService: MessageService,
    private messageGateway: MessageGateway,
    private cacheService: RedisCacheService,
  ) {}

  async create(userId: string, dto: CreateChannelDto): Promise<Channel> {
    const channel = await this.prisma.channel.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        createdById: userId,
        members: {
          create: {
            userId,
            role: MemberRole.ADMIN
          }
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    });

    return channel;
  }

  async findAll(userId: string, options: { 
    search?: string; 
    sortBy?: string; 
    sortOrder?: 'asc' | 'desc';
    type?: ChannelType;
  }) {
    const { search, sortBy = 'lastActivityAt', sortOrder = 'desc', type } = options;

    const channels = await this.prisma.channel.findMany({
      where: {
        type,
        OR: search ? [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ] : undefined,
        members: {
          some: {
            userId
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    });

    return channels;
  }

  async findOne(userId: string, channelId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    });

    if (!channel) {
      throw new ChannelNotFoundException(channelId);
    }

    const isMember = channel.members.some(member => member.userId === userId);
    if (!isMember) {
      throw new ChannelAccessDeniedException(channelId);
    }

    return channel;
  }

  async join(userId: string, channelId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: true
      }
    });

    if (!channel) {
      throw new ChannelNotFoundException(channelId);
    }

    if (channel.members.some(member => member.userId === userId)) {
      return this.findOne(userId, channelId);
    }

    await this.prisma.channelMember.create({
      data: {
        userId,
        channelId,
        role: MemberRole.MEMBER
      }
    });

    return this.findOne(userId, channelId);
  }

  async leave(userId: string, channelId: string, shouldDelete: boolean = false): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    
    if (shouldDelete) {
      const isAdmin = channel.members.some(m => m.userId === userId && m.role === MemberRole.ADMIN);
      if (!isAdmin) {
        throw new ForbiddenException('Only admins can delete channels');
      }

      await this.prisma.channel.delete({
        where: { id: channelId }
      });
    } else {
      await this.prisma.channelMember.delete({
        where: {
          channelId_userId: {
            channelId,
            userId
          }
        }
      });
    }
  }

  async markChannelAsRead(userId: string, channelId: string): Promise<void> {
    await this.validateMessageAccess(channelId, userId);
    
    const messages = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (messages.length > 0) {
      const lastMessage = messages[0];
      await this.messageService.updateDeliveryStatus(lastMessage.id, userId, MessageDeliveryStatus.READ);
    }
  }

  async getUnreadCount(userId: string, channelId: string): Promise<number> {
    await this.validateMessageAccess(channelId, userId);

    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId
        }
      }
    });

    if (!member) {
      return 0;
    }

    const count = await this.prisma.message.count({
      where: {
        channelId,
        parentId: null,
        createdAt: {
          gt: member.lastReadAt
        }
      }
    });

    return count;
  }

  async getChannelActivity(channelId: string): Promise<{ lastActivity: Date; memberCount: number }> {
    const cached = await this.cacheService.getChannelActivity(channelId);
    if (cached) return cached;

    const [lastMessage, memberCount] = await Promise.all([
      this.prisma.message.findFirst({
        where: { channelId },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.channelMember.count({
        where: { channelId }
      })
    ]);

    const activity = {
      lastActivity: lastMessage?.createdAt || new Date(),
      memberCount
    };

    await this.cacheService.setChannelActivity(channelId, activity);
    return activity;
  }

  async getChannelMetadata(userId: string, channelId: string): Promise<ChannelMetadataDto> {
    const channel = await this.findOne(userId, channelId);
    const activity = await this.getChannelActivity(channelId);
    const unreadCount = await this.getUnreadCount(userId, channelId);

    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      type: channel.type,
      memberCount: activity.memberCount,
      lastActivity: activity.lastActivity,
      unreadCount
    };
  }

  async getMessages(channelId: string, userId: string): Promise<MessageWithRelations[]> {
    await this.validateMessageAccess(channelId, userId);

    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId
        }
      }
    });

    if (!member) {
      return [];
    }

    const messages = await this.prisma.message.findMany({
      where: { 
        channelId,
        parentId: null,
        createdAt: {
          gt: member.lastReadAt
        }
      },
      include: messageWithRelationsInclude,
      orderBy: { createdAt: 'desc' },
      take: 50
    }) as MessageWithRelations[];

    return messages;
  }

  private async validateMessageAccess(channelId: string, userId: string): Promise<void> {
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId
        }
      }
    });

    if (!member) {
      throw new ChannelAccessDeniedException(channelId);
    }
  }
}