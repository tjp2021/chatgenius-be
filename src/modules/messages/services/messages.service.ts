import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { MessageDeliveryStatus } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(channelId: string, userId: string, limit = 50, cursor?: string) {
    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    // Get messages with cursor-based pagination
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
      },
      take: limit,
      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1, // Skip the cursor
      }),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      messages: messages.map(message => ({
        ...message,
        hasReplies: message._count.replies > 0,
      })),
      nextCursor,
    };
  }

  async getMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: message.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this message');
    }

    return message;
  }

  async createMessage(userId: string, createMessageDto: CreateMessageDto) {
    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: createMessageDto.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    const message = await this.prisma.message.create({
      data: {
        content: createMessageDto.content,
        channelId: createMessageDto.channelId,
        userId,
        replyToId: createMessageDto.replyToId,
        deliveryStatus: MessageDeliveryStatus.SENT,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return message;
  }

  async updateMessage(messageId: string, userId: string, updateMessageDto: UpdateMessageDto) {
    // Verify message exists and belongs to user
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: updateMessageDto,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    // Verify message exists and belongs to user
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });
  }

  async updateMessageDeliveryStatus(messageId: string, status: MessageDeliveryStatus) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deliveryStatus: status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  /**
   * Get the number of replies in a thread
   * @param threadId The ID of the message that started the thread
   * @returns The number of replies in the thread
   */
  async getThreadReplyCount(threadId: string): Promise<number> {
    const count = await this.prisma.message.count({
      where: {
        replyToId: threadId,
      },
    });

    return count;
  }

  /**
   * Get all messages in a thread with pagination
   * @param threadId The ID of the message that started the thread
   * @param userId The ID of the user requesting the messages
   * @param limit Maximum number of messages to return
   * @param cursor Cursor for pagination
   */
  async getThreadMessages(threadId: string, userId: string, limit = 50, cursor?: string) {
    // First get the thread starter message to verify channel access
    const threadStarter = await this.prisma.message.findUnique({
      where: { id: threadId },
      select: { channelId: true },
    });

    if (!threadStarter) {
      throw new NotFoundException('Thread not found');
    }

    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: threadStarter.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this thread');
    }

    // Get thread messages with cursor-based pagination
    const messages = await this.prisma.message.findMany({
      where: {
        replyToId: threadId,
      },
      take: limit,
      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1, // Skip the cursor
      }),
      orderBy: {
        createdAt: 'asc', // Thread messages in chronological order
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      messages,
      nextCursor,
    };
  }

  /**
   * Get thread details including the starter message
   * @param threadId The ID of the message that started the thread
   * @param userId The ID of the user requesting the details
   */
  async getThreadDetails(threadId: string, userId: string) {
    const threadStarter = await this.prisma.message.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true, // Count of replies in thread
          },
        },
      },
    });

    if (!threadStarter) {
      throw new NotFoundException('Thread not found');
    }

    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: threadStarter.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this thread');
    }

    // Get the latest reply
    const latestReply = await this.prisma.message.findFirst({
      where: {
        replyToId: threadId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return {
      threadStarter,
      replyCount: threadStarter._count.replies,
      latestReply,
    };
  }
} 