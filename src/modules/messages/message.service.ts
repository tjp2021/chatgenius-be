import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EventService } from '../../core/events/event.service';
import { MessageDeliveryService } from './services/message-delivery.service';
import { MessageDeliveryStatus, MessageDeliveryInfo } from './message.types';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly deliveryService: MessageDeliveryService,
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

    // Get channel members for delivery tracking
    const channelMembers = await this.prisma.channelMember.findMany({
      where: { channelId: data.channelId },
      select: { userId: true },
    });

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

    // Initialize delivery tracking for all channel members except sender
    const recipientIds = channelMembers
      .map(m => m.userId)
      .filter(id => id !== userId);
    
    await this.deliveryService.initializeDelivery(message.id, recipientIds);

    // Emit message created event with delivery status
    await this.eventService.emitToChannel(data.channelId, 'message.created', {
      ...message,
      deliveryStatus: MessageDeliveryStatus.SENT,
    });

    return {
      ...message,
      deliveryStatus: MessageDeliveryStatus.SENT,
    };
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

  async markAsDelivered(messageId: string, recipientId: string) {
    await this.deliveryService.updateDeliveryStatus(
      messageId,
      recipientId,
      MessageDeliveryStatus.DELIVERED
    );

    const message = await this.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Emit delivery status update
    await this.eventService.emitToChannel(
      message.channelId,
      'message.delivered',
      {
        messageId,
        recipientId,
        timestamp: new Date(),
      }
    );
  }

  async markAsSeen(messageId: string, recipientId: string) {
    await this.deliveryService.updateDeliveryStatus(
      messageId,
      recipientId,
      MessageDeliveryStatus.READ
    );

    const message = await this.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Emit seen status update
    await this.eventService.emitToChannel(
      message.channelId,
      'message.seen',
      {
        messageId,
        recipientId,
        timestamp: new Date(),
      }
    );
  }

  async getMessageDeliveryStatus(messageId: string): Promise<MessageDeliveryInfo[]> {
    const message = await this.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Get all channel members except the sender
    const channelMembers = await this.prisma.channelMember.findMany({
      where: { channelId: message.channelId },
      select: { userId: true },
    });

    const recipientIds = channelMembers
      .map(m => m.userId)
      .filter(id => id !== message.userId);

    return this.deliveryService.getAllRecipientStatuses(messageId, recipientIds);
  }
} 