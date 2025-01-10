import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../../../core/cache/redis.service';
import { MessageDeliveryService } from './message-delivery.service';
import { MessageDeliveryStatus } from '../message.types';
import { Message, User } from '../../../core/events/event.types';

@Injectable()
export class OfflineMessageService {
  private readonly logger = new Logger(OfflineMessageService.name);
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor(
    private readonly redisService: RedisCacheService,
    private readonly deliveryService: MessageDeliveryService,
  ) {}

  async queueMessageForOfflineUser(
    userId: string,
    message: Message & { user: User }
  ): Promise<void> {
    try {
      await this.redisService.queueOfflineMessage(userId, message);
      this.logger.debug(`Queued message ${message.id} for offline user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to queue message for offline user: ${error.message}`, {
        userId,
        messageId: message.id,
      });
      throw error;
    }
  }

  async processOfflineMessages(userId: string): Promise<void> {
    try {
      const messages = await this.redisService.getOfflineMessages(userId);
      if (!messages || messages.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${messages.length} offline messages for user ${userId}`);

      for (const message of messages) {
        await this.processMessage(userId, message);
      }

      // Clear processed messages
      await this.redisService.clearOfflineMessages(userId);
    } catch (error) {
      this.logger.error(`Failed to process offline messages: ${error.message}`, {
        userId,
      });
      throw error;
    }
  }

  private async processMessage(
    userId: string,
    message: Message & { user: User }
  ): Promise<void> {
    try {
      // Update delivery status to DELIVERED
      await this.deliveryService.updateDeliveryStatus(
        message.id,
        userId,
        MessageDeliveryStatus.DELIVERED
      );

      this.logger.debug(`Processed offline message ${message.id} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, {
        userId,
        messageId: message.id,
      });

      // Get current retry count
      const deliveryInfo = await this.deliveryService.getDeliveryStatus(message.id, userId);
      const retryCount = deliveryInfo?.retryCount || 0;

      if (retryCount < this.MAX_RETRY_ATTEMPTS) {
        // Schedule retry
        setTimeout(() => {
          this.processMessage(userId, message).catch(err => {
            this.logger.error(`Retry failed for message ${message.id}:`, err);
          });
        }, this.RETRY_DELAY * (retryCount + 1));

        // Update retry count
        await this.deliveryService.updateDeliveryStatus(
          message.id,
          userId,
          MessageDeliveryStatus.SENDING
        );
      } else {
        // Mark as failed after max retries
        await this.deliveryService.updateDeliveryStatus(
          message.id,
          userId,
          MessageDeliveryStatus.FAILED
        );
      }
    }
  }

  async getOfflineMessageCount(userId: string): Promise<number> {
    const messages = await this.redisService.getOfflineMessages(userId);
    return messages?.length || 0;
  }
} 