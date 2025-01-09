# Chat Genius Channels Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [HTTP API Endpoints](#http-api-endpoints)
4. [WebSocket Events](#websocket-events)
5. [Data Types](#data-types)
6. [Sample Integration Code](#sample-integration-code)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

## Overview

The Chat Genius channels system provides real-time messaging capabilities with support for:
- Public and private channels
- Direct messages (DMs)
- Message threads with reactions and read receipts
- Typing indicators
- Channel invitations
- Message delivery status tracking
- Real-time message reactions
- Read receipt tracking

### Key Features
- Real-time updates via WebSocket
- Message persistence
- Offline message queuing
- Read receipts and delivery status tracking
- Typing indicators
- Thread support with nested reactions
- Message reactions with user info
- Channel member management
- Message relationship tracking (parent/replies)

## Authentication

All requests (both HTTP and WebSocket) require authentication using a JWT token.

### HTTP Authentication
```typescript
// Add Bearer token to all requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

### WebSocket Authentication
```typescript
// Connect with auth
const socket = io('ws://your-server', {
  auth: {
    token: 'your-jwt-token',
    userId: 'your-user-id'
  }
});
```

## HTTP API Endpoints

### Channels

#### Create Channel
```http
POST /api/channels
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "string",
  "description": "string",
  "type": "PUBLIC" | "PRIVATE" | "DM"
}

Response 201:
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "type": "PUBLIC" | "PRIVATE" | "DM",
  "createdById": "uuid",
  "createdAt": "2024-01-09T00:00:00Z",
  "lastActivityAt": "2024-01-09T00:00:00Z",
  "memberCount": 0
}
```

#### Get Channel List
```http
GET /api/channels?search={search}&sortBy={sortBy}&sortOrder={sortOrder}&type={type}
Authorization: Bearer {token}

Query Parameters:
- search: string (optional)
- sortBy: "lastActivityAt" | "memberCount" | "createdAt" | "name"
- sortOrder: "asc" | "desc"
- type: "PUBLIC" | "PRIVATE" | "DM"

Response 200:
{
  "channels": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "type": "PUBLIC" | "PRIVATE" | "DM",
      "memberCount": 0,
      "lastActivityAt": "2024-01-09T00:00:00Z",
      "members": [
        {
          "userId": "uuid",
          "role": "ADMIN" | "MEMBER",
          "user": {
            "id": "uuid",
            "name": "string",
            "imageUrl": "string"
          }
        }
      ]
    }
  ]
}
```

#### Get Channel Details
```http
GET /api/channels/{channelId}
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "type": "PUBLIC" | "PRIVATE" | "DM",
  "memberCount": 0,
  "lastActivityAt": "2024-01-09T00:00:00Z",
  "members": [
    {
      "userId": "uuid",
      "role": "ADMIN" | "MEMBER",
      "user": {
        "id": "uuid",
        "name": "string",
        "imageUrl": "string"
      }
    }
  ]
}
```

#### Join Channel
```http
POST /api/channels/{channelId}/join
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "type": "PUBLIC" | "PRIVATE" | "DM",
  "memberCount": 1,
  "lastActivityAt": "2024-01-09T00:00:00Z"
}
```

#### Leave Channel
```http
DELETE /api/channels/{channelId}/leave?shouldDelete={boolean}
Authorization: Bearer {token}

Query Parameters:
- shouldDelete: boolean (optional) - If true and user is admin, deletes the channel

Response 200:
{
  "success": true
}
```

#### Channel Metadata
```http
GET /api/channels/{channelId}/metadata
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "type": "PUBLIC" | "PRIVATE" | "DM",
  "memberCount": 0,
  "lastActivity": "2024-01-09T00:00:00Z",
  "unreadCount": 0
}
```

### Messages

#### Get Channel Messages
```http
GET /api/channels/{channelId}/messages
Authorization: Bearer {token}

Response 200:
{
  "messages": [
    {
      "id": "uuid",
      "content": "string",
      "channelId": "uuid",
      "userId": "uuid",
      "parentId": "uuid",
      "createdAt": "2024-01-09T00:00:00Z",
      "updatedAt": "2024-01-09T00:00:00Z",
      "deliveryStatus": "SENT" | "DELIVERED" | "READ" | "FAILED",
      "replyCount": 0,
      "user": {
        "id": "uuid",
        "name": "string",
        "imageUrl": "string"
      },
      "reactions": [
        {
          "id": "uuid",
          "emoji": "string",
          "userId": "uuid",
          "user": {
            "id": "uuid",
            "name": "string",
            "imageUrl": "string"
          },
          "createdAt": "2024-01-09T00:00:00Z"
        }
      ],
      "readBy": [
        {
          "userId": "uuid",
          "readAt": "2024-01-09T00:00:00Z",
          "user": {
            "id": "uuid",
            "name": "string",
            "imageUrl": "string"
          }
        }
      ]
    }
  ]
}
```

#### Send Message
```http
POST /api/channels/{channelId}/messages
Content-Type: application/json
Authorization: Bearer {token}

{
  "content": "string",
  "parentId": "uuid" // Optional, for thread replies
}

Response 201:
{
  "id": "uuid",
  "content": "string",
  "channelId": "uuid",
  "userId": "uuid",
  "parentId": "uuid",
  "createdAt": "2024-01-09T00:00:00Z",
  "updatedAt": "2024-01-09T00:00:00Z",
  "deliveryStatus": "SENT",
  "replyCount": 0,
  "user": {
    "id": "uuid",
    "name": "string",
    "imageUrl": "string"
  }
}
```

### Message Reactions

#### Add Reaction
```http
POST /api/messages/{messageId}/reactions
Content-Type: application/json
Authorization: Bearer {token}

{
  "emoji": "string"
}

Response 201:
{
  "id": "uuid",
  "emoji": "string",
  "messageId": "uuid",
  "userId": "uuid",
  "user": {
    "id": "uuid",
    "name": "string",
    "imageUrl": "string"
  },
  "createdAt": "2024-01-09T00:00:00Z"
}
```

#### Remove Reaction
```http
DELETE /api/messages/{messageId}/reactions/{reactionId}
Authorization: Bearer {token}

Response 200:
{
  "success": true
}
```

### Message Read Status

#### Mark as Read
```http
POST /api/messages/{messageId}/read
Authorization: Bearer {token}

Response 200:
{
  "messageId": "uuid",
  "channelId": "uuid",
  "userId": "uuid",
  "readAt": "2024-01-09T00:00:00Z",
  "user": {
    "id": "uuid",
    "name": "string",
    "imageUrl": "string"
  }
}
```

#### Get Read Status
```http
GET /api/messages/{messageId}/read-status
Authorization: Bearer {token}

Response 200:
{
  "readBy": [
    {
      "userId": "uuid",
      "readAt": "2024-01-09T00:00:00Z",
      "user": {
        "id": "uuid",
        "name": "string",
        "imageUrl": "string"
      }
    }
  ],
  "readCount": 0,
  "totalMembers": 0
}
```

## WebSocket Events

### Message Events
```typescript
// Sending a message
socket.emit('message:send', {
  content: string,
  channelId: string,
  parentId?: string
});

// New message received
socket.on('message:new', (message: MessageWithRelations) => {
  // Handle new message
});

// Message sent confirmation
socket.on('message:sent', (message: MessageWithUser) => {
  // Handle sent confirmation
});

// Message deleted
socket.on('message:deleted', (messageId: string) => {
  // Handle message deletion
});

// Message delivery status update
socket.on('message:delivered', (data: {
  messageId: string,
  userId: string,
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
}) => {
  // Handle delivery status update
});

// Message read
socket.on('message:read', (data: {
  messageId: string,
  userId: string,
  readAt: string
}) => {
  // Handle read status update
});
```

### Reaction Events
```typescript
// Reaction added
socket.on('message:reaction:added', (data: {
  messageId: string,
  reaction: {
    id: string,
    emoji: string,
    userId: string,
    user: {
      id: string,
      name: string,
      imageUrl: string
    },
    createdAt: string
  }
}) => {
  // Handle new reaction
});

// Reaction removed
socket.on('message:reaction:removed', (data: {
  messageId: string,
  reactionId: string
}) => {
  // Handle reaction removal
});
```

### Typing Events
```typescript
// Start typing
socket.emit('message:typing:start', {
  channelId: string
});

// Stop typing
socket.emit('message:typing:stop', {
  channelId: string
});

// Typing status update
socket.on('message:typing:update', (data: {
  channelId: string,
  userId: string,
  isTyping: boolean
}) => {
  // Handle typing indicator
});
```

## Error Handling

### Common Error Responses
```typescript
{
  "statusCode": number,
  "message": string,
  "error": string
}
```

### Error Types
- `ChannelNotFoundException`: Channel does not exist
- `ChannelAccessDeniedException`: User does not have access to the channel
- `ChannelDeletedException`: Channel has been deleted
- `NetworkConnectivityException`: Connection issues
- `ChannelCapacityException`: Channel member limit reached

## Best Practices

1. **Message Handling**
   - Always handle offline messages when reconnecting
   - Implement retry logic for failed message sends
   - Cache messages locally for better performance

2. **Real-time Updates**
   - Implement proper reconnection logic for WebSocket
   - Handle typing indicators with debouncing
   - Update UI optimistically for better UX

3. **Error Handling**
   - Implement proper error boundaries
   - Show appropriate error messages to users
   - Handle network connectivity issues gracefully

4. **Performance**
   - Implement message pagination
   - Cache channel metadata
   - Use WebSocket for real-time updates instead of polling

## Architecture Notes

1. **Circular Dependencies**
   - The channels and messages systems are designed with a circular dependency pattern using NestJS's `forwardRef()`
   - This allows for proper separation of concerns while maintaining type safety
   - Both `ChannelsService` and `MessageService` can reference each other without causing dependency issues

2. **Message Relations**
   - Messages can have reactions, read receipts, and replies
   - All relations include user information for easy frontend display
   - Reactions and read receipts are tracked in real-time
   - Thread replies support nested reactions and read tracking

3. **Type Safety**
   - All message relations are properly typed using Prisma's generated types
   - Custom types like `MessageWithRelations` ensure complete type coverage
   - WebSocket events are fully typed for better development experience 