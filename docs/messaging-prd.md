# ChatGenius Messaging System - Current Implementation

## Overview
This document outlines the current implementation of the ChatGenius real-time messaging system. The system provides real-time message delivery, typing indicators, and read receipts through a combination of WebSocket events and REST APIs.

## System Architecture

### Core Components
1. **WebSocket Server**
   - Handles real-time message delivery
   - Manages typing indicators
   - Processes delivery confirmations
   - Maintains user presence

2. **REST API Server**
   - Message persistence
   - Message history retrieval
   - Thread/reply management

## Technical Specifications

### 1. WebSocket Connection

#### Connection Setup
```typescript
const socket = io('YOUR_WEBSOCKET_URL', {
  auth: {
    userId: string;    // Required: User identifier
    token: string;     // Required: JWT authentication token
  },
  withCredentials: true
});
```

#### Authentication Requirements
- Valid JWT token required
- User ID must match token payload
- Connection rejected if authentication fails
- CORS enabled only for specified origins

### 2. Message Events

#### 2.1 Sending Messages
```typescript
// Client -> Server
Event: MessageEvent.SEND
Payload: MessageEventDto {
  content: string;
  channelId: string;
  parentId?: string;  // For threaded replies
  deliveryStatus?: MessageDeliveryStatus;
}

// Server -> Channel Members
Event: MessageEvent.NEW
Payload: {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentId?: string;
  deliveryStatus: MessageDeliveryStatus;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
  createdAt: string;
}

// Server -> Sender
Event: MessageEvent.SENT
Payload: {
  messageId: string;
  channelId: string;
  status: MessageDeliveryStatus.SENT;
}
```

#### 2.2 Typing Indicators
```typescript
// Client -> Server
Event: MessageEvent.TYPING_START | MessageEvent.TYPING_STOP
Payload: TypingIndicatorDto {
  channelId: string;
  isTyping: boolean;
}

// Server -> Channel Members
Event: MessageEvent.TYPING_START | MessageEvent.TYPING_STOP
Payload: {
  userId: string;
  channelId: string;
  isTyping: boolean;
}
```

#### 2.3 Delivery Status
```typescript
// Client -> Server
Event: MessageEvent.DELIVERED | MessageEvent.READ
Payload: MessageDeliveryDto {
  messageId: string;
  channelId: string;
  status: MessageDeliveryStatus;
}

// Server -> Message Author
Event: MessageEvent.DELIVERED | MessageEvent.READ
Payload: MessageDeliveryDto {
  messageId: string;
  channelId: string;
  status: MessageDeliveryStatus;
}
```

### 3. REST API Endpoints

#### 3.1 Create Message
```typescript
POST /messages
Authorization: Bearer <token>

Request: CreateMessageDto {
  content: string;
  channelId: string;
  parentId?: string;
  deliveryStatus?: MessageDeliveryStatus;
}

Response: Message
```

#### 3.2 Get Channel Messages
```typescript
GET /messages/channel/:channelId
Query Parameters:
  - cursor?: string    // Message ID for pagination

Response: Message[]
// Returns up to 50 messages, ordered by createdAt ASC
```

#### 3.3 Get Message Replies
```typescript
GET /messages/:messageId/replies

Response: Message[]
// Returns replies ordered by createdAt ASC
```

### 4. Data Models

#### 4.1 Message States
```typescript
enum MessageDeliveryStatus {
  SENT = 'SENT',           // Sent to server
  DELIVERED = 'DELIVERED', // Delivered to recipient
  READ = 'READ',           // Read by recipient
  FAILED = 'FAILED'        // Failed to send
}
```

#### 4.2 Message Object
```typescript
interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentId?: string;
  deliveryStatus: MessageDeliveryStatus;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
  createdAt: string;
}
```

## Implementation Details

### 1. Message Delivery
- Messages are delivered in real-time to all users in the channel
- Messages are persisted in the database
- Basic parent-child threading support via parentId
- Channel activity is updated on message creation

### 2. Typing Indicators
- Real-time typing status updates
- Automatically cleared when message is sent
- Broadcast to all channel members

### 3. Message Threading
- Basic support for threaded replies using parentId
- Separate endpoint for fetching replies
- Replies are ordered chronologically

### 4. Error Handling
```typescript
// WebSocket Error Response
{
  status: 'error';
  message: string;
  code: string;
}

// Common Error Scenarios
- Unauthorized (missing or invalid userId/token)
- Not a channel member
- Network connectivity issues
```

### 5. Security Implementation
- JWT authentication required for all connections
- Channel membership verification for all operations
- CORS restrictions to specified origins
- Input validation using class-validator

## Database Schema
```sql
-- Message Delivery Status Enum
CREATE TYPE "MessageDeliveryStatus" AS ENUM (
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED'
);

-- Messages Table (Prisma Schema)
model Message {
  id             String               @id @default(uuid())
  content        String
  channelId      String
  userId         String
  parentId       String?
  deliveryStatus MessageDeliveryStatus @default(SENT)
  createdAt      DateTime            @default(now())
  user           User                @relation(fields: [userId], references: [id])
  channel        Channel             @relation(fields: [channelId], references: [id])
  parent         Message?            @relation("Replies", fields: [parentId], references: [id])
  replies        Message[]           @relation("Replies")
}