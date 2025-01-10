import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EventService } from '../../core/events/event.service';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  async getUserChannels(userId: string) {
    return this.prisma.channel.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  async create(userId: string, data: { channelId: string; content: string }) {
    // Check if user is member of channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: data.channelId,
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
        content: data.content,
        channelId: data.channelId,
        userId,
      },
      include: {
        user: true,
      },
    });

    // Emit message created event
    await this.eventService.emitToChannel(data.channelId, 'message.created', message);

    return message;
  }

  async update(messageId: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { user: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('Cannot edit message from another user');
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { content },
      include: { user: true },
    });

    // Emit message updated event
    await this.eventService.emitToChannel(message.channelId, 'message.updated', updatedMessage);

    return updatedMessage;
  }

  async delete(messageId: string, userId: string) {
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

    // Emit message deleted event
    await this.eventService.emitToChannel(message.channelId, 'message.deleted', { messageId });
  }

  async findAll(channelId: string) {
    return this.prisma.message.findMany({
      where: { channelId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.message.findUnique({
      where: { id },
      include: { user: true },
    });
  }
} 