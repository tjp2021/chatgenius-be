import { Injectable } from '@nestjs/common';
import { RedisCacheService } from '../../../core/cache/redis.service';
import { MessageDeliveryStatus, MessageDeliveryInfo } from '../message.types';

@Injectable()
export class MessageDeliveryService {
  private readonly DELIVERY_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(private readonly redisService: RedisCacheService) {}

  async initializeDelivery(messageId: string, recipientIds: string[]): Promise<void> {
    const userStatuses = recipientIds.map(recipientId => ({
      userId: recipientId,
      status: MessageDeliveryStatus.SENT
    }));

    await this.redisService.setMessageDeliveryStatuses(messageId, userStatuses);
  }

  async updateDeliveryStatus(
    messageId: string,
    recipientId: string,
    status: MessageDeliveryStatus
  ): Promise<void> {
    await this.redisService.setMessageDeliveryStatus(messageId, recipientId, status);
  }

  async getDeliveryStatus(messageId: string, recipientId: string): Promise<MessageDeliveryInfo | null> {
    const status = await this.redisService.getMessageDeliveryStatus(messageId, recipientId);
    
    if (!status) {
      return null;
    }

    return {
      messageId,
      recipientId,
      status: status as MessageDeliveryStatus,
      timestamp: new Date(),
    };
  }

  async getAllRecipientStatuses(messageId: string, recipientIds: string[]): Promise<MessageDeliveryInfo[]> {
    const statuses = await this.redisService.getMessageDeliveryStatuses(messageId, recipientIds);
    
    return statuses
      .filter(status => status.status !== null)
      .map(status => ({
        messageId,
        recipientId: status.userId,
        status: status.status as MessageDeliveryStatus,
        timestamp: new Date(),
      }));
  }
} 