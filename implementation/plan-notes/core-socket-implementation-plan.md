# Core Socket Implementation Plan [CG-20240111-001]

## Overview
This plan focuses on implementing the essential socket functionality, deliberately excluding non-critical features to ensure a solid foundation.

## Phase 1: Authentication & Connection (Day 1)

### 1. Clean Up Authentication
- [ ] Remove redundant auth checks
  - Delete duplicate token verification
  - Consolidate auth in WsGuard
  - Simplify token extraction

### 2. Standardize Connection Flow
- [ ] Implement clear connection stages
  - Initial connection
  - Authentication
  - Room joining
  - Ready state

### 3. Success Criteria
- Single point of authentication
- Clear connection lifecycle
- Proper error handling
- Room management working

## Phase 2: Basic Messaging (Day 2)

### 1. Core Message Events
- [ ] Implement essential events
  ```typescript
  // Required events
  'message:send'    // Send new message
  'message:receive' // Receive new message
  'message:error'   // Handle message errors
  ```

### 2. Channel Management
- [ ] Basic channel operations
  ```typescript
  // Required operations
  'channel:join'    // Join channel
  'channel:leave'   // Leave channel
  'channel:error'   // Handle channel errors
  ```

### 3. Success Criteria
- Messages can be sent/received
- Channel join/leave works
- Basic error handling exists

## Phase 3: Room Management (Day 3)

### 1. Room Structure
- [ ] Implement room hierarchy
  ```typescript
  // Room types
  `user:${userId}`      // Personal room
  `channel:${channelId}` // Channel room
  ```

### 2. Room Operations
- [ ] Core room functionality
  - Join user's personal room
  - Join channel rooms
  - Handle disconnections
  - Clean up on leave

### 3. Success Criteria
- Clear room structure
- Proper room cleanup
- No memory leaks

## Implementation Details

### 1. Socket Guard (WsGuard)
```typescript
@Injectable()
export class WsGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractToken(client);
    if (!token) return false;
    
    const userId = await this.verifyClerkToken(token);
    if (!userId) return false;

    client.userId = userId;
    return true;
  }
}
```

### 2. Base Gateway
```typescript
@WebSocketGateway()
export class WsGateway extends BaseGateway {
  async handleConnection(client: AuthenticatedSocket) {
    // 1. Join personal room
    await client.join(`user:${client.userId}`);
    
    // 2. Join channel rooms
    const channels = await this.channelService.getUserChannels(client.userId);
    for (const channel of channels) {
      await client.join(`channel:${channel.id}`);
    }
    
    // 3. Mark as ready
    client.emit('connection:ready');
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    // Clean up rooms
    const rooms = [...client.rooms];
    await Promise.all(rooms.map(room => client.leave(room)));
  }
}
```

### 3. Message Gateway
```typescript
@WebSocketGateway()
export class MessageGateway {
  @SubscribeMessage('message:send')
  async handleMessage(
    client: AuthenticatedSocket,
    payload: { channelId: string; content: string }
  ) {
    // 1. Save message
    const message = await this.messageService.create({
      userId: client.userId,
      ...payload
    });

    // 2. Broadcast to channel
    this.server.to(`channel:${payload.channelId}`).emit('message:new', message);

    return { success: true, messageId: message.id };
  }
}
```

## Testing Strategy

### 1. Connection Tests
```typescript
describe('Socket Connection', () => {
  it('should connect with valid token', async () => {
    // Test connection with valid token
  });

  it('should reject invalid token', async () => {
    // Test connection with invalid token
  });
});
```

### 2. Message Tests
```typescript
describe('Message Handling', () => {
  it('should send message to channel', async () => {
    // Test message sending
  });

  it('should broadcast to correct room', async () => {
    // Test room broadcasting
  });
});
```

## Success Metrics
1. Authentication success rate > 99%
2. Message delivery success rate > 99%
3. Room management working correctly
4. No memory leaks in room management
5. Clear error handling for all operations

## What We're NOT Doing
1. ❌ Advanced error recovery
2. ❌ Performance monitoring
3. ❌ Resource limits
4. ❌ Connection pooling
5. ❌ Advanced metrics

## Next Steps After Core Implementation
1. Add comprehensive testing
2. Implement monitoring
3. Add performance optimization
4. Enhance error handling
5. Add resource management 