# WebSocket Events Documentation

## Overview
This document outlines all WebSocket events used in the chat application. All events follow a colon-separated naming convention (e.g., `channel:join`, `message:send`).

## Connection Setup

### Authentication
```typescript
// Connect with authentication
const socket = io(WEBSOCKET_URL, {
  auth: {
    token: string,  // Clerk JWT token
    userId: string  // User ID from Clerk
  },
  transports: ['websocket']
});
```

### Connection Events
```typescript
// Connection Status Events (Server -> Client)
socket.on('connection:starting', () => {})
socket.on('connection:ready', () => {})
socket.on('connection:error', (error: { message: string }) => {})
```

## Channel Events

### Client -> Server
```typescript
// Channel Management
socket.emit('channel:create', {
  name: string,
  type: 'PUBLIC' | 'PRIVATE' | 'DM',
  description?: string,
  memberIds?: string[]
})

socket.emit('channel:update', {
  channelId: string,
  name?: string,
  description?: string
})

socket.emit('channel:join', {
  channelId: string
})

socket.emit('channel:leave', {
  channelId: string,
  shouldDelete?: boolean
})

socket.emit('channel:member:role', {
  channelId: string,
  userId: string,
  role: 'OWNER' | 'MEMBER'
})
```

### Server -> Client
```typescript
// Channel Updates
socket.on('channel:created', (channel: Channel) => {})
socket.on('channel:updated', (channel: Channel) => {})
socket.on('channel:deleted', (channelId: string) => {})
socket.on('channel:member_count', ({
  channelId: string,
  count: number
}) => {})
```

## Message Events

### Client -> Server
```typescript
// Message Operations
socket.emit('message:send', {
  channelId: string,
  content: string
})

socket.emit('message:delivered', {
  messageId: string
})

socket.emit('message:read', {
  messageId: string
})

// Typing Indicators
socket.emit('message:typing:start', {
  channelId: string
})

socket.emit('message:typing:stop', {
  channelId: string
})
```

### Server -> Client
```typescript
// Message Updates
socket.on('message:new', (message: Message) => {})
socket.on('message:updated', (message: Message) => {})
socket.on('message:deleted', (messageId: string) => {})
socket.on('message:status', ({
  messageId: string,
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
  userId: string
}) => {})

// Typing Indicators
socket.on('user:typing', ({
  channelId: string,
  userId: string
}) => {})
```

## User Status Events

### Server -> Client
```typescript
socket.on('user:online', (userId: string) => {})
socket.on('user:offline', (userId: string) => {})
```

## Response Format

### Success Response
```typescript
{
  success: true,
  data: any  // Response data varies by event
}
```

### Error Response
```typescript
{
  success: false,
  error: string  // Error message
}
```

## Type Definitions

### Channel Type
```typescript
interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  memberCount: number;
  members: Array<{
    userId: string;
    role: 'OWNER' | 'MEMBER';
    user: {
      id: string;
      name: string;
      imageUrl?: string;
    };
  }>;
}
```

### Message Type
```typescript
interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deliveryStatus: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  user: {
    id: string;
    name: string;
    imageUrl?: string;
  };
}
```

## Best Practices

1. **Error Handling**
   - Always implement error handling for all event emissions
   - Use try-catch blocks in event handlers
   - Handle timeout scenarios for acknowledgments

2. **Connection Management**
   - Implement reconnection logic
   - Handle connection errors gracefully
   - Clean up event listeners on disconnect

3. **Event Naming**
   - Use colon-separated event names (e.g., `channel:join`)
   - Follow the established naming convention consistently
   - Never mix dot notation with colon notation

4. **Type Safety**
   - Use TypeScript interfaces for all event payloads
   - Validate data before emitting events
   - Handle null/undefined cases

5. **Performance**
   - Implement debouncing for typing indicators
   - Use acknowledgments for critical operations
   - Handle message queuing for offline scenarios 