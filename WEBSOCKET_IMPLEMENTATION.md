# WebSocket Implementation Plan

## Current Implementation Status

### Implemented Features
1. Basic Socket.IO setup with CORS
2. Channel room management (join/leave)
3. Basic presence updates
4. Redis cache service for:
   - Channel membership
   - Channel activity
   - Channel lists

### Missing Features
1. Redis-based online users tracking
2. Rate limiting
3. Comprehensive error handling
4. Cleanup for stale connections
5. Multi-node scaling support

## Implementation Plan

### 1. Redis Online Users Tracking

```typescript
// Add to redis.service.ts
interface OnlineUser {
  userId: string;
  socketId: string;
  lastSeen: Date;
}

export class RedisCacheService {
  // Add new methods
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `online:${userId}`;
    await this.redis?.set(key, JSON.stringify({
      userId,
      socketId,
      lastSeen: new Date()
    }), 'EX', 300); // 5 minutes
  }

  async getUserOnlineStatus(userId: string): Promise<OnlineUser | null> {
    if (!this.isEnabled) return null;
    const key = `online:${userId}`;
    const cached = await this.redis?.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async removeUserOnline(userId: string): Promise<void> {
    if (!this.isEnabled) return;
    const key = `online:${userId}`;
    await this.redis?.del(key);
  }

  async getAllOnlineUsers(): Promise<OnlineUser[]> {
    if (!this.isEnabled) return [];
    const keys = await this.redis?.keys('online:*');
    if (!keys?.length) return [];
    
    const users = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis?.get(key);
        return data ? JSON.parse(data) : null;
      })
    );
    
    return users.filter(Boolean);
  }
}
```

### 2. Rate Limiting Implementation

```typescript
// Create new file: src/gateways/rate-limit.service.ts
import { Injectable } from '@nestjs/common';
import { RedisCacheService } from '../cache/redis.service';

@Injectable()
export class RateLimitService {
  constructor(private redis: RedisCacheService) {}

  async checkRateLimit(userId: string, event: string): Promise<boolean> {
    const key = `ratelimit:${userId}:${event}`;
    const limit = this.getEventLimit(event);
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }
    
    return count <= limit;
  }

  private getEventLimit(event: string): number {
    const limits = {
      'message:send': 60,    // 60 messages per minute
      'channel:join': 10,    // 10 channel joins per minute
      'default': 100         // default limit
    };
    
    return limits[event] || limits.default;
  }
}
```

### 3. Enhanced Error Handling

```typescript
// Add to socket.gateway.ts
import { WsException } from '@nestjs/websockets';

export class SocketGateway {
  private handleError(client: Socket, error: any) {
    const errorResponse = {
      status: 'error',
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR'
    };
    
    client.emit('error', errorResponse);
    this.logger.error(error);
  }

  @SubscribeMessage('channel:join')
  async handleChannelJoin(client: Socket, channelId: string) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) throw new WsException('Unauthorized');

      const canJoin = await this.rateLimitService.checkRateLimit(userId, 'channel:join');
      if (!canJoin) throw new WsException('Rate limit exceeded');

      // ... rest of the join logic
    } catch (error) {
      this.handleError(client, error);
    }
  }
}
```

### 4. Stale Connection Cleanup

```typescript
// Add to socket.gateway.ts
export class SocketGateway {
  private readonly staleTimeout = 5 * 60 * 1000; // 5 minutes

  @Interval(60000) // Run every minute
  async cleanupStaleConnections() {
    try {
      const onlineUsers = await this.redis.getAllOnlineUsers();
      const now = new Date();
      
      for (const user of onlineUsers) {
        const lastSeen = new Date(user.lastSeen);
        if (now.getTime() - lastSeen.getTime() > this.staleTimeout) {
          await this.handleDisconnect({ id: user.socketId, handshake: { auth: { userId: user.userId } } } as Socket);
        }
      }
    } catch (error) {
      this.logger.error('Cleanup error:', error);
    }
  }
}
```

### 5. Multi-Node Scaling Support

```typescript
// Add to socket.gateway.ts
import { createAdapter } from '@socket.io/redis-adapter';

export class SocketGateway implements OnModuleInit {
  async onModuleInit() {
    if (this.redis.isEnabled) {
      const pubClient = this.redis.getClient();
      const subClient = pubClient.duplicate();
      
      this.server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Redis adapter enabled for Socket.IO');
    }
  }
}
```

## Required Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
SOCKET_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
```

## Testing Plan

1. Unit Tests
   - Redis service methods
   - Rate limiting service
   - Error handling
   - Socket event handlers

2. Integration Tests
   - Connection/disconnection flows
   - Channel join/leave operations
   - Rate limiting behavior
   - Multi-node communication

3. Load Tests
   - Concurrent connections
   - Message broadcasting
   - Redis adapter performance

## Deployment Considerations

1. Redis Configuration
   - Enable persistence
   - Configure maxmemory policy
   - Set appropriate timeout values

2. Scaling
   - Use Redis Cluster for large deployments
   - Configure proper number of Socket.IO workers
   - Monitor memory usage

3. Security
   - Implement proper authentication
   - Set up rate limiting
   - Configure CORS properly
   - Use secure Redis connections 