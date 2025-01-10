# WebSocket Authentication Documentation

## Overview

This document details the WebSocket authentication system implemented in the ChatGenius backend. The system uses Clerk for authentication and implements a multi-layered security approach.

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [Implementation Details](#implementation-details)
3. [Security Measures](#security-measures)
4. [Frontend Integration](#frontend-integration)
5. [Room Management](#room-management)
6. [WebSocket Events](#websocket-events)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

## Authentication Flow

### 1. Connection Initialization

```typescript
// Frontend Connection Setup
const socket = io(BACKEND_URL, {
  auth: {
    token: await getToken() // Raw Clerk JWT token (NO 'Bearer ' prefix)
  },
  transports: ['websocket'],
  autoConnect: true
});
```

### 2. Server-Side Authentication Process

The authentication happens in multiple layers:

1. **WsGuard (Primary Authentication)**
2. **BaseGateway Authentication**
3. **Connection Validation**
4. **Room Assignment**

## Implementation Details

### 1. WsGuard Implementation

```typescript
@Injectable()
export class WsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    
    // 1. Extract token
    const token = client.handshake.auth.token;
    if (!token) return false;

    // 2. Verify with Clerk
    const verifyResult = await clerkClient.verifyToken(token);
    if (!verifyResult.sub) return false;

    // 3. Enhance socket with user data
    const socket = client as AuthenticatedSocket;
    socket.userId = verifyResult.sub;
    socket.user = { id: verifyResult.sub };

    return true;
  }
}
```

### 2. Socket Types

```typescript
interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
  };
}

interface SocketResponse<T> {
  data?: T;
  error?: string;
}
```

### 3. Token Blacklisting

```typescript
@Injectable()
export class TokenBlacklistService {
  private readonly redis: Redis;
  private readonly keyPrefix = 'blacklist:token:';

  async blacklistToken(token: string, expirationTime: number): Promise<void> {
    const key = this.keyPrefix + token;
    await this.redis.set(key, '1', 'EX', expirationTime);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const key = this.keyPrefix + token;
    return await this.redis.exists(key) === 1;
  }
}
```

## Security Measures

1. **Token Validation**
   - Clerk JWT verification
   - Token blacklisting support
   - No Bearer prefix requirement
   - Automatic disconnection for invalid tokens

2. **Connection Security**
   - CORS configuration
   - WebSocket-only transport
   - Credential requirement
   - Automatic cleanup on disconnect

3. **Room Security**
   - Personal user rooms (`user:${userId}`)
   - Channel-specific rooms (`channel:${channelId}`)
   - Automatic room cleanup
   - Permission-based room access

## Frontend Integration

### 1. Connection Setup

```typescript
// CORRECT Implementation
const socket = io(BACKEND_URL, {
  auth: { token: await getToken() },
  transports: ['websocket'],
  autoConnect: true
});

// Event Handlers
socket.on('connect', () => {
  // Connection successful
});

socket.on('error', (error) => {
  // Handle authentication errors
});

socket.on('disconnect', () => {
  // Handle disconnection
});
```

### 2. Common Mistakes to Avoid

```typescript
// ❌ WRONG: Including Bearer prefix
auth: { token: `Bearer ${token}` }

// ❌ WRONG: Using HTTP headers
headers: { Authorization: `Bearer ${token}` }

// ❌ WRONG: Not handling disconnection
socket.on('connect', () => {
  // start using socket immediately
});

// ✅ CORRECT: Proper error handling
socket.on('connect', () => {
  if (!socket.connected) return;
  // then start using socket
});
```

## Room Management

```typescript
class WsGateway extends BaseGateway {
  async handleConnection(client: AuthenticatedSocket) {
    if (!this.validateClient(client)) return;

    const userId = this.getClientUserId(client);
    
    // Join personal room
    client.join(`user:${userId}`);
    
    // Join channel rooms
    const channels = this.eventService.getUserChannels(userId);
    channels.forEach(channelId => {
      client.join(`channel:${channelId}`);
    });
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.getClientUserId(client);
    if (!userId) return;

    // Cleanup all rooms
    const channels = this.eventService.getUserChannels(userId);
    channels.forEach(channelId => {
      this.eventService.unsubscribe(channelId, client.id, userId);
      client.leave(`channel:${channelId}`);
    });

    client.leave(`user:${userId}`);
  }
}
```

## WebSocket Events

### Message Events

```typescript
// Sending/Receiving Messages
socket.emit('sendMessage', { content: string, channelId: string });
socket.on('message.created', (message) => { /* New message */ });

socket.emit('updateMessage', { messageId: string, content: string });
socket.on('message.updated', (message) => { /* Updated message */ });

socket.emit('deleteMessage', { messageId: string });
socket.on('message.deleted', ({ messageId }) => { /* Deleted message */ });

// Delivery Status
socket.emit('message:delivered', { messageId: string });
socket.emit('message:seen', { messageId: string });
socket.emit('message:getStatus', { messageId: string }, (response) => {
  // Get message delivery status
});

// Typing Indicators
socket.emit('typing', { channelId: string });
socket.emit('typing:stop', { channelId: string });
socket.emit('typing:get', { channelId: string }, (response) => {
  // Get currently typing users
});

// Offline Messages
socket.emit('message:getOfflineCount', (response) => {
  // Get count of missed messages
});
```

### Event Response Types

```typescript
interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deliveryStatus: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  user: User;
}

interface DeliveryStatus {
  messageId: string;
  recipientId: string;
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  timestamp: Date;
}

interface TypingIndicator {
  userId: string;
  channelId: string;
  isTyping: boolean;
  timestamp: Date;
}
```

### Event Handling Best Practices

1. **Message Operations**
   - Always handle delivery status updates
   - Implement optimistic updates for better UX
   - Handle message failures with retry logic
   - Update UI immediately for sent messages

2. **Typing Indicators**
   - Implement debouncing (recommended: 500ms)
   - Clear typing state on message send
   - Handle cleanup on channel switch
   - Auto-expire after 5 seconds of inactivity

3. **Offline Messages**
   - Check offline count on reconnection
   - Process missed messages in order
   - Update delivery status for processed messages
   - Handle failed message delivery

4. **Error Handling**
   - Implement retry logic for failed operations
   - Handle rate limiting gracefully
   - Log failed message operations
   - Provide user feedback for failures

## Error Handling

```typescript
// 1. Authentication Errors
socket.on('error', (error) => {
  if (error.message.includes('authentication')) {
    // Handle auth failure
  }
});

// 2. Connection Errors
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server forced disconnect
  } else {
    // Connection lost
  }
});
```

## Best Practices

1. **Token Management**
   - Never store tokens in localStorage
   - Implement proper token refresh
   - Handle token expiration
   - Use secure token storage

2. **Connection Management**
   - Implement reconnection strategy
   - Handle connection timeouts
   - Clean up resources on disconnect
   - Monitor connection state

3. **Security**
   - Use environment variables for sensitive data
   - Implement rate limiting
   - Monitor failed authentication attempts
   - Regular security audits

4. **Error Handling**
   - Implement proper error logging
   - Handle all error scenarios
   - Provide meaningful error messages
   - Implement retry mechanisms

5. **Performance**
   - Use WebSocket transport only
   - Implement proper connection pooling
   - Handle concurrent connections
   - Monitor memory usage 