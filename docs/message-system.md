# Chat Genius Message System Documentation

## Table of Contents
1. [Overview](#overview)
2. [HTTP API Endpoints](#http-api-endpoints)
3. [WebSocket Events](#websocket-events)
4. [Message Delivery System](#message-delivery-system)
5. [Offline Message Handling](#offline-message-handling)
6. [Typing Indicators](#typing-indicators)
7. [Error Handling](#error-handling)
8. [Sample Integration Code](#sample-integration-code)

## Overview

The Chat Genius message system is built on a hybrid architecture using:
- HTTP endpoints for state changes and message CRUD
- WebSocket events for real-time updates
- Redis for caching and real-time features
- PostgreSQL (via Prisma) for persistent storage

### Key Features
- Real-time message delivery
- Offline message queuing
- Message delivery confirmation
- Read receipts
- Typing indicators
- Thread support
- Proper error handling and recovery

## HTTP API Endpoints

### Create Message
```http
POST /api/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Hello, world!",
  "channelId": "uuid",
  "parentId": "uuid" // Optional, for thread replies
}

Response 201:
{
  "id": "uuid",
  "content": "Hello, world!",
  "channelId": "uuid",
  "userId": "uuid",
  "parentId": "uuid",
  "createdAt": "2024-01-09T12:00:00Z",
  "updatedAt": "2024-01-09T12:00:00Z",
  "deliveryStatus": "SENT",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "imageUrl": "https://..."
  }
}
```

### Get Channel Messages
```http
GET /api/messages/channel/{channelId}?cursor={messageId}
Authorization: Bearer {token}

Response 200:
{
  "messages": [
    {
      "id": "uuid",
      "content": "Hello, world!",
      "channelId": "uuid",
      "userId": "uuid",
      "parentId": null,
      "createdAt": "2024-01-09T12:00:00Z",
      "updatedAt": "2024-01-09T12:00:00Z",
      "deliveryStatus": "DELIVERED",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "imageUrl": "https://..."
      }
    }
  ],
  "nextCursor": "uuid"
}
```

### Get Thread Replies
```http
GET /api/messages/{messageId}/replies
Authorization: Bearer {token}

Response 200:
{
  "replies": [
    {
      "id": "uuid",
      "content": "Reply message",
      "channelId": "uuid",
      "userId": "uuid",
      "parentId": "uuid",
      "createdAt": "2024-01-09T12:00:00Z",
      "updatedAt": "2024-01-09T12:00:00Z",
      "deliveryStatus": "SENT",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "imageUrl": "https://..."
      }
    }
  ]
}
```

## WebSocket Events

### Connection
```typescript
// Connect to WebSocket
const socket = io('ws://your-server', {
  auth: {
    token: 'your-jwt-token',
    userId: 'your-user-id'
  }
});

// Handle connection
socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

// Handle errors
socket.on('message:error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Message Events

#### Send Message
```typescript
// Send message
socket.emit('message:send', {
  content: 'Hello, world!',
  channelId: 'channel-uuid',
  parentId: 'parent-message-uuid' // Optional
});

// Handle sent confirmation
socket.on('message:sent', (data) => {
  console.log('Message sent:', data.messageId);
});

// Handle new messages
socket.on('message:new', (message) => {
  console.log('New message received:', message);
});
```

#### Message Delivery
```typescript
// Mark message as delivered
socket.emit('message:delivered', {
  messageId: 'message-uuid',
  channelId: 'channel-uuid'
});

// Handle delivery confirmation
socket.on('message:delivered', (data) => {
  console.log('Message delivered:', data);
});

// Mark message as read
socket.emit('message:read', {
  messageId: 'message-uuid',
  channelId: 'channel-uuid'
});

// Handle read confirmation
socket.on('message:read', (data) => {
  console.log('Message read:', data);
});
```

#### Typing Indicators
```typescript
// Send typing start
socket.emit('message:typing:start', {
  channelId: 'channel-uuid',
  isTyping: true
});

// Send typing stop
socket.emit('message:typing:stop', {
  channelId: 'channel-uuid',
  isTyping: false
});

// Handle typing indicators
socket.on('message:typing:start', (data) => {
  console.log('User typing:', data.userId);
});

socket.on('message:typing:stop', (data) => {
  console.log('User stopped typing:', data.userId);
});
```

### Offline Messages
```typescript
// Handle offline messages on reconnection
socket.on('message:offline', (messages) => {
  console.log('Received offline messages:', messages);
});
```

## Message Delivery System

### Delivery States
1. `SENT` - Message created and sent to server
2. `DELIVERED` - Message received by recipient's client
3. `READ` - Message opened/read by recipient
4. `FAILED` - Message delivery failed

### Delivery Flow
1. Sender creates message → Status: SENT
2. Server queues for offline users
3. Online recipients receive via WebSocket → Status: DELIVERED
4. Recipients mark as read → Status: READ

## Offline Message Handling

Messages sent while recipients are offline are:
1. Stored in Redis queue with 24-hour TTL
2. Delivered when recipient connects
3. Removed from queue after delivery
4. Marked as DELIVERED on recipient connection

## Typing Indicators

### Features
- 5-second TTL in Redis
- Automatic cleanup on disconnect
- Per-channel status tracking
- Real-time updates to all channel members

### Implementation Notes
- Use debounce on client side (recommended: 300ms)
- Clear typing status on message send
- Handle disconnections gracefully

## Error Handling

### Common Error Types
```typescript
interface WebSocketError {
  code: string;
  message: string;
}

// Error Codes
const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};
```

### Error Recovery
1. Socket disconnection: Automatic reconnection with exponential backoff
2. Message send failure: Retry with increasing delays
3. Delivery status sync: Periodic status check for unconfirmed messages

## Sample Integration Code

### React Hook Example
```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseMessageSystemProps {
  token: string;
  userId: string;
  channelId: string;
}

export const useMessageSystem = ({ token, userId, channelId }: UseMessageSystemProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    // Initialize socket
    const newSocket = io('ws://your-server', {
      auth: { token, userId }
    });

    // Handle connection
    newSocket.on('connect', () => {
      console.log('Connected to message system');
    });

    // Handle new messages
    newSocket.on('message:new', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Handle typing indicators
    newSocket.on('message:typing:start', (data) => {
      setTypingUsers(prev => [...prev, data.userId]);
    });

    newSocket.on('message:typing:stop', (data) => {
      setTypingUsers(prev => prev.filter(id => id !== data.userId));
    });

    // Handle offline messages
    newSocket.on('message:offline', (offlineMessages: Message[]) => {
      setMessages(prev => [...prev, ...offlineMessages]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, userId]);

  // Send message function
  const sendMessage = async (content: string, parentId?: string) => {
    if (!socket) return;

    socket.emit('message:send', {
      content,
      channelId,
      parentId
    });
  };

  // Handle typing indicator
  const handleTyping = (isTyping: boolean) => {
    if (!socket) return;

    socket.emit(
      isTyping ? 'message:typing:start' : 'message:typing:stop',
      { channelId, isTyping }
    );
  };

  return {
    messages,
    typingUsers,
    sendMessage,
    handleTyping,
    isConnected: socket?.connected
  };
};
```

### Usage Example
```typescript
function ChatComponent() {
  const { 
    messages, 
    typingUsers, 
    sendMessage, 
    handleTyping 
  } = useMessageSystem({
    token: 'your-token',
    userId: 'your-user-id',
    channelId: 'channel-id'
  });

  return (
    <div>
      {/* Messages list */}
      <div className="messages">
        {messages.map(message => (
          <MessageComponent key={message.id} message={message} />
        ))}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.length} user(s) typing...
        </div>
      )}

      {/* Message input */}
      <MessageInput
        onTyping={handleTyping}
        onSend={sendMessage}
      />
    </div>
  );
}
```

## Best Practices

1. **Error Handling**
   - Always handle WebSocket errors
   - Implement reconnection logic
   - Show appropriate UI feedback

2. **Performance**
   - Debounce typing indicators
   - Implement message pagination
   - Cache messages locally

3. **User Experience**
   - Show delivery status
   - Implement optimistic updates
   - Handle offline state gracefully

4. **Security**
   - Validate all payloads
   - Use proper authentication
   - Implement rate limiting 