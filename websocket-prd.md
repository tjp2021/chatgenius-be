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

# WebSocket Integration Guide

## Connection Settings

### Socket Server Configuration
```typescript
const socket = io({
  path: '/api/socket.io',
  withCredentials: true,
  autoConnect: true,
  // Server accepts connections from any origin
  // but requires authentication
});
```

### Authentication
The WebSocket server requires authentication using the same session token as your REST API. Ensure your token is included in the connection request.

## Event Types

### Connection Events

#### Client -> Server
- Connection is handled automatically when initializing the socket client
- Server will automatically join the client to all their authorized channel rooms

#### Server -> Client
- On successful connection: Client will be connected and joined to their channels
- On failed connection: Socket will be disconnected

### Message Events

#### Sending Messages
```typescript
// Client -> Server
socket.emit('message:send', {
  content: string,      // Message content
  channelId: string,    // Target channel ID
  tempId?: string       // Optional temporary ID for tracking message status
});

// Server -> Client responses
socket.on('message:delivered', {
  messageId: string,    // Permanent server-generated ID
  tempId?: string,      // Your original tempId if provided
  status: string        // Message delivery status
});

socket.on('message:created', {
  message: {           // Complete message object
    id: string,
    content: string,
    // ... other message fields
  },
  tempId?: string      // Original tempId if provided
});

socket.on('message:failed', {
  error: string,       // Error message
  tempId?: string,     // Original tempId if provided
  status: 'FAILED'     // Failed status
});
```

### Reaction Events

#### Adding Reactions
```typescript
// Client -> Server
socket.emit('reaction:add', {
  messageId: string,    // Target message ID
  type: string         // Reaction type/emoji
});

// Server -> Client (broadcast to channel)
socket.on('reaction:added', {
  messageId: string,    // Message ID
  reaction: {          // Complete reaction object
    // ... reaction fields
  }
});
```

#### Removing Reactions
```typescript
// Client -> Server
socket.emit('reaction:remove', {
  messageId: string,    // Target message ID
  type: string         // Reaction type/emoji
});

// Server -> Client (broadcast to channel)
socket.on('reaction:removed', {
  messageId: string,    // Message ID
  userId: string,      // User who removed the reaction
  type: string         // Reaction type that was removed
});
```

### Channel Events

#### Joining Channels
```typescript
// Client -> Server
socket.emit('channel:join', {
  channelId: string    // Channel to join
});

// Response will be success/error object
```

#### Leaving Channels
```typescript
// Client -> Server
socket.emit('channel:leave', {
  channelId: string    // Channel to leave
});

// Response will be success/error object
```

## Error Handling

All events return a response object in the format:
```typescript
interface SuccessResponse {
  success: true;
  data?: any;
}

interface ErrorResponse {
  success: false;
  error: string;
}
```

## Best Practices

1. **Connection Management**
   - Implement reconnection logic
   - Handle disconnection events
   - Verify connection status before sending messages

2. **Message Handling**
   - Use tempId for tracking message status
   - Implement local message queue for offline/failed messages
   - Show appropriate UI feedback based on message status

3. **Error Handling**
   - Implement error listeners for all emitted events
   - Show appropriate error messages to users
   - Implement retry logic for failed operations

## Example Implementation

```typescript
import { io, Socket } from 'socket.io-client';

class ChatService {
  private socket: Socket;

  constructor() {
    this.socket = io({
      path: '/api/socket.io',
      withCredentials: true,
      autoConnect: true
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });

    this.socket.on('message:created', (data) => {
      // Handle new message
    });

    this.socket.on('message:delivered', (data) => {
      // Update message status
    });

    this.socket.on('message:failed', (data) => {
      // Handle failed message
    });
  }

  public sendMessage(channelId: string, content: string) {
    const tempId = generateTempId(); // Implement your tempId generation
    
    this.socket.emit('message:send', {
      channelId,
      content,
      tempId
    });

    return tempId; // Return tempId for tracking
  }

  public addReaction(messageId: string, type: string) {
    this.socket.emit('reaction:add', {
      messageId,
      type
    });
  }

  public joinChannel(channelId: string) {
    this.socket.emit('channel:join', {
      channelId
    });
  }
}
```
