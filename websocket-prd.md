# WebSocket Implementation PRD

## 1. Overview

### 1.1 Purpose
Define standardized practices and implementation guidelines for WebSocket integration in the ChatGenius platform, ensuring scalable, maintainable, and efficient real-time communication.

### 1.2 Scope
- Real-time messaging system
- Presence management
- Typing indicators
- Message status updates
- Channel activity notifications

## 2. Technical Requirements

### 2.1 Technology Stack
- NestJS WebSocket Gateway
- Socket.IO
- Redis for socket state
- TypeScript for type safety

### 2.2 Feature-Technology Mapping

| Feature | Technology | Justification |
|---------|------------|---------------|
| Messaging | WebSocket | Real-time updates required |
| File Upload | HTTP | Large data transfer |
| User Auth | HTTP | Security best practice |
| Presence | WebSocket + Redis | Real-time with state |
| Channel Updates | HTTP + WebSocket | CRUD + notifications |

## 3. Implementation Guidelines

### 3.1 Event Naming Convention
```typescript
// Required Format: {entity}:{action}
message:send      // Sending new message
message:edit      // Editing message
user:typing       // Typing indicator
presence:update   // Status update
```

### 3.2 Room Management Structure
```typescript
// Room Naming Convention
`user:${userId}`       // User-specific updates
`channel:${channelId}` // Channel messages
`thread:${threadId}`   // Thread updates
`presence:global`      // Global presence updates
```

### 3.3 State Management Rules
1. Persistent Data
   - Database: Messages, channels, users
   - Redis: Temporary state (presence, typing)
   - Memory: Active connections only

2. State Operations
   ```typescript
   // Good Practice
   class PresenceService {
     constructor(
       private readonly redis: Redis,
       private readonly prisma: PrismaService
     ) {}

     async updateUserStatus(userId: string, status: UserStatus) {
       // 1. Update Redis for real-time state
       await this.redis.set(`presence:${userId}`, status);
       // 2. Update DB for persistence
       await this.prisma.user.update({...});
     }
   }
   ```

## 4. Security Requirements

### 4.1 Authentication
```typescript
// Required Implementation
@WebSocketGateway()
export class ChatGateway {
  async handleConnection(client: Socket) {
    try {
      // 1. Validate token
      const user = await this.authService.validateToken(
        client.handshake.auth.token
      );
      
      // 2. Attach user data
      client.data.user = user;
      
      // 3. Join user room
      await client.join(`user:${user.id}`);
      
    } catch (error) {
      client.disconnect();
    }
  }
}
```

### 4.2 Rate Limiting
- Message sending: 60/minute
- Typing indicators: 10/minute
- Presence updates: 30/minute
- Connection attempts: 10/minute

## 5. Error Handling Standards

### 5.1 Error Response Format
```typescript
interface ErrorResponse {
  status: 'error';
  code: ErrorCode;
  message: string;
  data?: any;
}

// Required Error Codes
enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  CHANNEL_ERROR = 'CHANNEL_ERROR'
}
```

### 5.2 Error Broadcasting Rules
1. User-specific errors: Emit only to affected user
2. Channel errors: Emit to channel members
3. Global errors: Log but don't broadcast

## 6. Performance Requirements

### 6.1 Metrics
- Connection establishment: < 1s
- Message delivery: < 100ms
- Presence updates: < 200ms
- Room join/leave: < 100ms

### 6.2 Scaling Considerations
- Horizontal scaling with Redis adapter
- Room shard management
- Connection pooling
- Message batching for bulk operations

## 7. Implementation Structure

### 7.1 Required Directory Structure
```
src/
  websocket/
    gateways/
      chat.gateway.ts
      presence.gateway.ts
    services/
      socket.service.ts
      presence.service.ts
    interfaces/
      events.interface.ts
      payloads.interface.ts
    guards/
      ws-auth.guard.ts
    constants/
      events.constant.ts
```

### 7.2 Core Components
1. ChatGateway
   - Message handling
   - Channel management
   - Thread management

2. PresenceGateway
   - Online status
   - Typing indicators
   - Activity tracking

3. SocketService
   - Connection management
   - Room management
   - Event broadcasting

## 8. Testing Requirements

### 8.1 Unit Tests
```typescript
describe('ChatGateway', () => {
  it('should emit to correct room', () => {
    // Test room-specific broadcasts
  });
  
  it('should handle client disconnect', () => {
    // Test cleanup procedures
  });
});
```

### 8.2 Integration Tests
- Connection flow
- Authentication process
- Room management
- Event broadcasting
- Error handling

## 9. Monitoring & Logging

### 9.1 Required Metrics
- Active connections
- Messages per second
- Average latency
- Error rate
- Room membership counts

### 9.2 Logging Requirements
```typescript
// Required Log Format
{
  timestamp: ISOString,
  level: 'info' | 'warn' | 'error',
  event: string,
  userId?: string,
  channelId?: string,
  metadata?: object
}
```

## 10. Migration Strategy

### 10.1 Phase 1: Basic Implementation
- Connection management
- Basic messaging
- Room structure

### 10.2 Phase 2: Enhanced Features
- Presence system
- Typing indicators
- Message status

### 10.3 Phase 3: Scaling Features
- Redis integration
- Sharding support
- Performance optimization

## 11. Success Criteria

### 11.1 Technical Metrics
- 99.9% uptime
- < 100ms average latency
- < 0.1% error rate
- < 1s connection time

### 11.2 Business Metrics
- Real-time message delivery
- Consistent presence updates
- Accurate typing indicators
- Scalable to 100k concurrent users

## 12. Documentation Requirements

### 12.1 Required Documentation
- API specifications
- Event catalog
- Error code reference
- Integration guide
- Architecture diagram

### 12.2 Maintenance Guide
- Deployment procedures
- Monitoring setup
- Troubleshooting steps
- Performance tuning
