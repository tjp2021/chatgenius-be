import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Channel, ChannelMember, User, Message } from '../events/event.types';
import { DMTypingStatus } from '../types/dm.types';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly redis: Redis | null = null;
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly isEnabled: boolean = false;
  private readonly DEFAULT_TTL = 3600; // 1 hour in seconds

  constructor(private configService: ConfigService) {
    try {
      if (this.configService.get('REDIS_HOST')) {
        this.redis = new Redis({
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: this.configService.get('REDIS_PORT', 6379),
          password: this.configService.get('REDIS_PASSWORD'),
          keyPrefix: 'chatgenius:',
        });
        this.isEnabled = true;
        this.logger.log('Redis cache enabled');
      } else {
        this.logger.warn('Redis cache disabled - REDIS_HOST not configured');
      }
    } catch (error) {
      this.logger.warn('Failed to initialize Redis cache:', error.message);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async getChannelMembership(userId: string, channelId: string): Promise<(Channel & { members: (ChannelMember & { user: User })[] }) | null> {
    if (!this.isEnabled) return null;
    const key = `membership:${userId}:${channelId}`;
    const cached = await this.redis?.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setChannelMembership(userId: string, channelId: string, data: Channel & { members: (ChannelMember & { user: User })[] }): Promise<void> {
    if (!this.isEnabled) return;
    const key = `membership:${userId}:${channelId}`;
    await this.redis?.set(key, JSON.stringify(data), 'EX', 300); // 5 minutes
  }

  async invalidateChannelMembership(userId: string, channelId: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `membership:${userId}:${channelId}`;
    await this.redis?.del(key);
  }

  async getChannelActivity(channelId: string): Promise<{ lastActivity: Date; memberCount: number } | null> {
    if (!this.isEnabled) return null;
    const key = `activity:${channelId}`;
    const cached = await this.redis?.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setChannelActivity(channelId: string, data: { lastActivity: Date; memberCount: number }): Promise<void> {
    if (!this.isEnabled) return;
    const key = `activity:${channelId}`;
    await this.redis?.set(key, JSON.stringify(data), 'EX', 300); // 5 minutes
  }

  async invalidateChannelActivity(channelId: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `activity:${channelId}`;
    await this.redis?.del(key);
  }

  async cacheChannelList(userId: string, channels: any[]): Promise<void> {
    if (!this.isEnabled) return;
    const key = `channels:${userId}`;
    await this.redis?.set(key, JSON.stringify(channels), 'EX', 300); // 5 minutes
  }

  async getCachedChannelList(userId: string): Promise<any[] | null> {
    if (!this.isEnabled) return null;
    const key = `channels:${userId}`;
    const cached = await this.redis?.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateChannelList(userId: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `channels:${userId}`;
    await this.redis?.del(key);
  }

  async setTypingStatus(channelId: string, data: DMTypingStatus): Promise<void> {
    if (!this.isEnabled) return;
    const key = `typing:${channelId}`;
    await this.redis?.set(key, JSON.stringify(data), 'EX', 5); // 5 seconds
  }

  async getTypingStatus(channelId: string): Promise<DMTypingStatus | null> {
    if (!this.isEnabled) return null;
    const key = `typing:${channelId}`;
    const cached = await this.redis?.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateTypingStatus(channelId: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `typing:${channelId}`;
    await this.redis?.del(key);
  }

  async getValue(key: string): Promise<any> {
    try {
      const value = await this.redis?.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting value for key ${key}:`, error);
      return null;
    }
  }

  async setValue(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.redis?.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Error setting value for key ${key}:`, error);
    }
  }

  async clearKey(key: string): Promise<void> {
    try {
      await this.redis?.del(key);
    } catch (error) {
      this.logger.error(`Error clearing key ${key}:`, error);
    }
  }

  // Message Queue Methods
  async queueOfflineMessage(userId: string, message: Message & { user: User }): Promise<void> {
    if (!this.isEnabled) return;
    const key = `offline:messages:${userId}`;
    const messages = await this.getOfflineMessages(userId) || [];
    messages.push(message);
    await this.redis?.set(key, JSON.stringify(messages), 'EX', 86400); // 24 hours
  }

  async getOfflineMessages(userId: string): Promise<(Message & { user: User })[] | null> {
    if (!this.isEnabled) return null;
    const key = `offline:messages:${userId}`;
    const cached = await this.redis?.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async clearOfflineMessages(userId: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `offline:messages:${userId}`;
    await this.redis?.del(key);
  }

  // Message Delivery Status
  async setMessageDeliveryStatus(messageId: string, userId: string, status: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `message:delivery:${messageId}:${userId}`;
    await this.redis?.set(key, status, 'EX', 86400); // 24 hours
  }

  async getMessageDeliveryStatus(messageId: string, userId: string): Promise<string | null> {
    if (!this.isEnabled) return null;
    const key = `message:delivery:${messageId}:${userId}`;
    return this.redis?.get(key);
  }

  // Batch Operations for Message Delivery
  async setMessageDeliveryStatuses(messageId: string, userStatuses: { userId: string; status: string }[]): Promise<void> {
    if (!this.isEnabled) return;
    const pipeline = this.redis?.pipeline();
    
    for (const { userId, status } of userStatuses) {
      const key = `message:delivery:${messageId}:${userId}`;
      pipeline?.set(key, status, 'EX', 86400);
    }
    
    await pipeline?.exec();
  }

  async getMessageDeliveryStatuses(messageId: string, userIds: string[]): Promise<{ userId: string; status: string | null }[]> {
    if (!this.isEnabled) return userIds.map(userId => ({ userId, status: null }));
    const pipeline = this.redis?.pipeline();
    
    for (const userId of userIds) {
      const key = `message:delivery:${messageId}:${userId}`;
      pipeline?.get(key);
    }
    
    const results = await pipeline?.exec();
    return results?.map((result, index) => ({
      userId: userIds[index],
      status: result[1] as string | null,
    })) || [];
  }
} 