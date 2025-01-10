import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../../../core/cache/redis.service';
import { EventService } from '../../../core/events/event.service';

interface TypingUser {
  userId: string;
  channelId: string;
  timestamp: Date;
}

@Injectable()
export class TypingIndicatorService {
  private readonly logger = new Logger(TypingIndicatorService.name);
  private readonly TYPING_EXPIRY = 5; // 5 seconds
  private readonly CLEANUP_INTERVAL = 1000; // 1 second
  private readonly typingUsers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly redisService: RedisCacheService,
    private readonly eventService: EventService,
  ) {
    // Start cleanup interval
    setInterval(() => this.cleanupStaleIndicators(), this.CLEANUP_INTERVAL);
  }

  private getTypingKey(channelId: string, userId: string): string {
    return `typing:${channelId}:${userId}`;
  }

  async setTyping(userId: string, channelId: string): Promise<void> {
    const key = this.getTypingKey(channelId, userId);
    
    // Clear existing timeout if any
    const existingTimeout = this.typingUsers.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set typing status in Redis
    await this.redisService.setValue(key, {
      userId,
      channelId,
      timestamp: new Date(),
    }, this.TYPING_EXPIRY);

    // Emit typing event
    await this.eventService.emitToChannel(channelId, 'user:typing', {
      userId,
      channelId,
      isTyping: true,
      timestamp: new Date(),
    });

    // Set timeout to clear typing status
    const timeout = setTimeout(async () => {
      await this.clearTyping(userId, channelId);
    }, this.TYPING_EXPIRY * 1000);

    this.typingUsers.set(key, timeout);
  }

  async clearTyping(userId: string, channelId: string): Promise<void> {
    const key = this.getTypingKey(channelId, userId);
    
    // Clear from Redis
    await this.redisService.clearKey(key);
    
    // Clear from local tracking
    const timeout = this.typingUsers.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.typingUsers.delete(key);
    }

    // Emit stopped typing event
    await this.eventService.emitToChannel(channelId, 'user:typing', {
      userId,
      channelId,
      isTyping: false,
      timestamp: new Date(),
    });
  }

  async getTypingUsers(channelId: string): Promise<string[]> {
    const pattern = this.getTypingKey(channelId, '*');
    const keys = await this.redisService.getKeysByPattern(pattern);
    
    const typingUsers: string[] = [];
    for (const key of keys) {
      const value = await this.redisService.getValue(key);
      if (value) {
        typingUsers.push(value.userId);
      }
    }
    
    return typingUsers;
  }

  async handleUserDisconnect(userId: string): Promise<void> {
    // Find all typing indicators for this user
    const pattern = this.getTypingKey('*', userId);
    const keys = await this.redisService.getKeysByPattern(pattern);
    
    // Clear all typing indicators for this user
    for (const key of keys) {
      const value = await this.redisService.getValue(key);
      if (value) {
        await this.clearTyping(userId, value.channelId);
      }
    }
  }

  private async cleanupStaleIndicators(): Promise<void> {
    try {
      const now = new Date();
      
      // Check all typing users in memory
      for (const [key, timeout] of this.typingUsers.entries()) {
        const value = await this.redisService.getValue(key);
        
        // If Redis value is gone or stale, clear the typing indicator
        if (!value || now.getTime() - new Date(value.timestamp).getTime() > this.TYPING_EXPIRY * 1000) {
          const [, channelId, userId] = key.split(':');
          await this.clearTyping(userId, channelId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup stale typing indicators:', error);
    }
  }
} 