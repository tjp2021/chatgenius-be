import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Channel, ChannelMember, User } from '@prisma/client';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly redis: Redis | null = null;
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly isEnabled: boolean = false;

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
} 