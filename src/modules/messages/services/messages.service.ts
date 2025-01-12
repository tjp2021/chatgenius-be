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
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      messages,
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
} 