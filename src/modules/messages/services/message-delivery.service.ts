import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../../../core/cache/redis.service';
import { MessageDeliveryStatus, MessageDeliveryInfo } from '../message.types';

@Injectable()
export class MessageDeliveryService {
  private readonly DELIVERY_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly logger = new Logger(MessageDeliveryService.name);

  constructor(private readonly redisService: RedisCacheService) {}

  async initializeDelivery(messageId: string, recipientIds: string[]): Promise<void> {
    try {
      const userStatuses = recipientIds.map(recipientId => ({
        userId: recipientId,
        status: MessageDeliveryStatus.SENT
      }));

      await this.redisService.setMessageDeliveryStatuses(messageId, userStatuses);
      this.logger.debug(`Initialized delivery status for message ${messageId} with ${recipientIds.length} recipients`);
    } catch (error) {
      this.logger.error(`Failed to initialize delivery status for message ${messageId}:`, error);
      throw error;
    }
  }

  async updateDeliveryStatus(
    messageId: string,
    recipientId: string,
    status: MessageDeliveryStatus
  ): Promise<void> {
    try {
      await Promise.all([
        // Update status in Redis
        this.redisService.setMessageDeliveryStatus(messageId, recipientId, status),
        // Invalidate cached statuses for this message
        this.redisService.clearKey(`message:delivery:cache:${messageId}`)
      ]);

      this.logger.debug(`Updated delivery status for message ${messageId}, recipient ${recipientId} to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update delivery status for message ${messageId}:`, error);
      throw error;
    }
  }

  async getDeliveryStatus(messageId: string, recipientId: string): Promise<MessageDeliveryInfo | null> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to get delivery status for message ${messageId}:`, error);
      throw error;
    }
  }

  async getAllRecipientStatuses(messageId: string, recipientIds: string[]): Promise<MessageDeliveryInfo[]> {
    try {
      // Check cache first
      const cachedStatuses = await this.redisService.getValue(`message:delivery:cache:${messageId}`);
      if (cachedStatuses) {
        this.logger.debug(`Cache hit for message ${messageId} delivery statuses`);
        return cachedStatuses;
      }

      // If not in cache, get from main storage
      const statuses = await this.redisService.getMessageDeliveryStatuses(messageId, recipientIds);
      
      const deliveryInfos = statuses
        .filter(status => status.status !== null)
        .map(status => ({
          messageId,
          recipientId: status.userId,
          status: status.status as MessageDeliveryStatus,
          timestamp: new Date(),
        }));

      // Cache the results
      await this.redisService.setValue(
        `message:delivery:cache:${messageId}`,
        deliveryInfos,
        this.CACHE_TTL
      );

      this.logger.debug(`Retrieved and cached delivery statuses for message ${messageId}`);
      return deliveryInfos;
    } catch (error) {
      this.logger.error(`Failed to get all recipient statuses for message ${messageId}:`, error);
      throw error;
    }
  }

  async batchUpdateDeliveryStatus(
    updates: Array<{ messageId: string; recipientId: string; status: MessageDeliveryStatus }>
  ): Promise<void> {
    try {
      // Group updates by messageId for efficient cache invalidation
      const messageIds = new Set(updates.map(update => update.messageId));

      await Promise.all([
        // Batch update statuses
        this.redisService.setMessageDeliveryStatusesBatch(updates),
        // Invalidate caches for all affected messages
        ...Array.from(messageIds).map(messageId =>
          this.redisService.clearKey(`message:delivery:cache:${messageId}`)
        )
      ]);

      this.logger.debug(`Batch updated ${updates.length} delivery statuses`);
    } catch (error) {
      this.logger.error('Failed to batch update delivery statuses:', error);
      throw error;
    }
  }
} 