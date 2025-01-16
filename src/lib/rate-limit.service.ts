import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RateLimitService {
  protected redis: Redis;
  private readonly logger = new Logger(RateLimitService.name);
  private readonly keyPrefix = 'ratelimit:';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const redisKey = this.keyPrefix + key;
    
    try {
      // Get current count
      const count = await this.redis.incr(redisKey);
      
      // Set expiry if this is the first request in window
      if (count === 1) {
        await this.redis.expire(redisKey, windowSeconds);
      }
      
      return count > limit;
    } catch (error) {
      this.logger.error(`Rate limit check failed: ${error.message}`);
      return false; // Fail open if Redis is down
    }
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
} 