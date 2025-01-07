import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class TokenBlacklistService {
  private readonly redis: Redis;
  private readonly keyPrefix = 'blacklist:token:';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async blacklistToken(token: string, expirationTime: number): Promise<void> {
    const key = this.keyPrefix + token;
    await this.redis.set(key, '1', 'EX', expirationTime);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const key = this.keyPrefix + token;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
} 