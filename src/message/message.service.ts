import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  async createMessage(channelId: string, userId: string, dto: CreateMessageDto) {
    // Verify channel membership
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this channel');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        channelId,
        userId,
        parentId: dto.parentId,
      },
      include: {
        user: true,
        parent: true,
        replies: {
          include: {
            user: true,
          },
        },
      },
    });

    return message;
  }

  async findMessages(channelId: string, userId: string, cursor?: string) {
    // Verify channel membership
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this channel');
    }

    // Get messages with cursor-based pagination
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        parentId: null, // Only get top-level messages
      },
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
        replies: {
          include: {
            user: true,
          },
          take: 3, // Get latest 3 replies
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    return messages;
  }

  async findReplies(messageId: string, userId: string, cursor?: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify channel membership
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: message.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this channel');
    }

    // Get replies with cursor-based pagination
    const replies = await this.prisma.message.findMany({
      where: {
        parentId: messageId,
      },
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
      },
    });

    return replies;
  }

  async updateMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('Cannot edit message from another user');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content },
      include: {
        user: true,
        parent: true,
        replies: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('Cannot delete message from another user');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    return { id: messageId };
  }
} 