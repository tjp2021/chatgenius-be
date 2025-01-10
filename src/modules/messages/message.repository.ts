import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Message, Reaction, Prisma } from '@prisma/client';

export { MessageDeliveryStatus } from '@prisma/client';

@Injectable()
export class MessageRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    content: string;
    channelId: string;
    userId: string;
  }): Promise<Message> {
    return this.prisma.message.create({
      data: {
        content: data.content,
        channelId: data.channelId,
        userId: data.userId,
        deliveryStatus: 'SENT',
      },
      include: {
        user: true,
        channel: true,
        reactions: true,
      },
    });
  }

  async findById(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id },
      include: {
        user: true,
        channel: true,
        reactions: true,
      },
    });
  }

  async findByChannelId(channelId: string, limit: number = 50): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: true,
        channel: true,
        reactions: true,
      },
    });
  }

  async update(id: string, data: { content: string }): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data: {
        content: data.content,
        updatedAt: new Date(),
      },
      include: {
        user: true,
        channel: true,
        reactions: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.message.delete({
      where: { id },
    });
  }

  async addReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    await this.prisma.reaction.create({
      data: {
        messageId,
        userId,
        type: reaction,
      },
    });
  }

  async removeReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    await this.prisma.reaction.delete({
      where: {
        messageId_userId_type: {
          messageId,
          userId,
          type: reaction,
        },
      },
    });
  }
} 