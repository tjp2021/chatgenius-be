import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChannelsService } from '../channels/channels.service';
import { MessageDeliveryStatus } from './dto/message-events.enum';
import { 
  MessageWithRelations, 
  MessageWithUser, 
  MessageWithReactions,
  MessageWithReadReceipts,
  MessageResponse
} from './types/message.types';
import { RedisCacheService } from '../cache/redis.service';
import { Prisma } from '@prisma/client';
import { MessageReadReceiptDto, MessageReadStatusDto } from '../channels/dto/message-read.dto';
import { ThreadResponseDto } from '../channels/dto/message-thread.dto';
import { MessageReactionResponseDto } from '../channels/dto/message-reaction.dto';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChannelsService))
    private channelsService: ChannelsService,
    private cacheService: RedisCacheService,
  ) {}

  async create(userId: string, dto: CreateMessageDto): Promise<MessageWithUser> {
    // Create message with pending status
    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        channelId: dto.channelId,
        userId,
        parentId: dto.parentId,
        deliveryStatus: MessageDeliveryStatus.SENT,
      },
      include: {
        user: true,
      },
    });

    // Update channel last activity
    await this.prisma.channel.update({
      where: { id: dto.channelId },
      data: { lastActivityAt: new Date() },
    });

    // Get channel members and queue message for offline members
    const channelMembers = await this.prisma.channelMember.findMany({
      where: { channelId: dto.channelId },
      include: { user: true },
    });

    const offlineMembers = channelMembers.filter(member => !member.user.isOnline);
    
    // Queue message for offline members
    await Promise.all(
      offlineMembers.map(member => 
        this.cacheService.queueOfflineMessage(member.userId, message)
      )
    );

    // Set initial delivery status for all members
    await this.cacheService.setMessageDeliveryStatuses(
      message.id,
      channelMembers.map(member => ({
        userId: member.userId,
        status: member.user.isOnline ? MessageDeliveryStatus.DELIVERED : MessageDeliveryStatus.SENT,
      }))
    );

    return message;
  }

  async updateDeliveryStatus(messageId: string, userId: string, status: MessageDeliveryStatus): Promise<MessageWithUser> {
    // Update Redis first for immediate availability
    await this.cacheService.setMessageDeliveryStatus(messageId, userId, status);

    // Then update database
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deliveryStatus: status,
      },
      include: {
        user: true,
      },
    });

    return message;
  }

  async getOfflineMessages(userId: string): Promise<MessageWithUser[]> {
    const messages = await this.cacheService.getOfflineMessages(userId);
    if (messages && messages.length > 0) {
      // Clear offline messages after retrieving them
      await this.cacheService.clearOfflineMessages(userId);
    }
    return messages || [];
  }

  async getMessageDeliveryStatus(messageId: string, userId: string): Promise<string | null> {
    return this.cacheService.getMessageDeliveryStatus(messageId, userId);
  }

  async getMessageDeliveryStatuses(messageId: string, userIds: string[]): Promise<{ userId: string; status: string | null }[]> {
    return this.cacheService.getMessageDeliveryStatuses(messageId, userIds);
  }

  async findAll(channelId: string, cursor?: string): Promise<MessageWithUser[]> {
    return this.prisma.message.findMany({
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        channelId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: true,
      },
    });
  }

  async findAllWithRelations(channelId: string, cursor?: string): Promise<MessageWithRelations[]> {
    return this.prisma.message.findMany({
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        channelId,
        parentId: null
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: true,
        parent: {
          include: {
            user: true
          }
        },
        replies: {
          include: {
            user: true,
            reactions: {
              include: {
                user: true
              }
            },
            readBy: {
              include: {
                user: true
              }
            }
          }
        },
        reactions: {
          include: {
            user: true
          }
        },
        readBy: {
          include: {
            user: true
          }
        }
      }
    }) as Promise<MessageWithRelations[]>;
  }

  async findReplies(messageId: string): Promise<MessageWithUser[]> {
    return this.prisma.message.findMany({
      where: {
        parentId: messageId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: true,
      },
    });
  }

  async markAsRead(messageId: string, userId: string): Promise<MessageReadReceiptDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: true,
      }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const readReceipt = await this.prisma.readReceipt.create({
      data: {
        messageId,
        userId,
      },
      include: {
        user: true
      }
    });

    return {
      messageId,
      channelId: message.channelId,
      userId,
      readAt: readReceipt.readAt,
      user: {
        id: readReceipt.user.id,
        name: readReceipt.user.name,
        imageUrl: readReceipt.user.imageUrl
      }
    };
  }

  async getReadStatus(messageId: string, userId: string): Promise<MessageReadStatusDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          include: {
            members: true
          }
        },
        readBy: {
          include: {
            user: true
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const readBy = message.readBy.map(receipt => ({
      userId: receipt.userId,
      readAt: receipt.readAt,
      user: {
        id: receipt.user.id,
        name: receipt.user.name,
        imageUrl: receipt.user.imageUrl
      }
    }));

    return {
      readBy,
      readCount: readBy.length,
      totalMembers: message.channel.members.length
    };
  }

  async getThread(messageId: string, userId: string): Promise<ThreadResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: true,
        replies: {
          include: {
            user: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Get unique participant count
    const participants = new Set(
      [message, ...message.replies].map(msg => msg.userId)
    );

    const lastReply = message.replies[message.replies.length - 1];

    return {
      parentMessage: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        user: {
          id: message.user.id,
          name: message.user.name,
          imageUrl: message.user.imageUrl
        }
      },
      replies: message.replies.map(reply => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        user: {
          id: reply.user.id,
          name: reply.user.name,
          imageUrl: reply.user.imageUrl
        },
        parentId: messageId,
        replyCount: 0 // Nested replies not supported yet
      })),
      participantCount: participants.size,
      lastReplyAt: lastReply?.createdAt || null
    };
  }

  async createReply(parentMessageId: string, userId: string, content: string): Promise<MessageWithUser> {
    const parentMessage = await this.prisma.message.findUnique({
      where: { id: parentMessageId }
    });

    if (!parentMessage) {
      throw new NotFoundException('Parent message not found');
    }

    const reply = await this.prisma.message.create({
      data: {
        content,
        userId,
        channelId: parentMessage.channelId,
        parentId: parentMessageId
      },
      include: {
        user: true
      }
    });

    // Update reply count
    await this.prisma.message.update({
      where: { id: parentMessageId },
      data: {
        replyCount: {
          increment: 1
        }
      }
    });

    return reply;
  }

  async getThreadedMessages(channelId: string, userId: string): Promise<MessageWithRelations[]> {
    return this.prisma.message.findMany({
      where: {
        channelId,
        parentId: null,
        replyCount: {
          gt: 0
        }
      },
      include: {
        user: true,
        parent: {
          include: {
            user: true
          }
        },
        replies: {
          include: {
            user: true,
            reactions: {
              include: {
                user: true
              }
            },
            readBy: true
          }
        },
        reactions: {
          include: {
            user: true
          }
        },
        readBy: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as Promise<MessageWithRelations[]>;
  }

  async getChannelMessages(channelId: string, userId: string): Promise<MessageWithRelations[]> {
    return this.prisma.message.findMany({
      where: {
        channelId,
        parentId: null
      },
      include: {
        user: true,
        parent: {
          include: {
            user: true
          }
        },
        replies: {
          include: {
            user: true,
            reactions: {
              include: {
                user: true
              }
            },
            readBy: true
          }
        },
        reactions: {
          include: {
            user: true
          }
        },
        readBy: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    }) as Promise<MessageWithRelations[]>;
  }

  async delete(messageId: string, userId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('Cannot delete messages from other users');
    }

    await this.prisma.message.delete({
      where: { id: messageId }
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<MessageReactionResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const reaction = await this.prisma.reaction.create({
      data: {
        messageId,
        userId,
        emoji
      },
      include: {
        user: true
      }
    });

    return {
      id: reaction.id,
      emoji: reaction.emoji,
      messageId: reaction.messageId,
      userId: reaction.userId,
      user: {
        id: reaction.user.id,
        name: reaction.user.name,
        imageUrl: reaction.user.imageUrl
      },
      createdAt: reaction.createdAt
    };
  }

  async removeReaction(messageId: string, reactionId: string, userId: string): Promise<void> {
    const reaction = await this.prisma.reaction.findFirst({
      where: {
        id: reactionId,
        messageId,
        userId
      }
    });

    if (!reaction) {
      throw new NotFoundException('Reaction not found');
    }

    await this.prisma.reaction.delete({
      where: { id: reactionId }
    });
  }

  async getReactions(messageId: string): Promise<MessageReactionResponseDto[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        reactions: {
          include: {
            user: true
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message.reactions.map(reaction => ({
      id: reaction.id,
      emoji: reaction.emoji,
      messageId: reaction.messageId,
      userId: reaction.userId,
      user: {
        id: reaction.user.id,
        name: reaction.user.name,
        imageUrl: reaction.user.imageUrl
      },
      createdAt: reaction.createdAt
    }));
  }
} 