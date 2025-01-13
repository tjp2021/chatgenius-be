# Thread System Documentation

## Overview
The thread system allows users to create threaded conversations from any message in a channel. It supports real-time updates, pagination, and proper race condition handling.

## Core User Flow

### 1. Viewing Thread Status in Channel
Each message in a channel includes thread metadata:
```typescript
interface Message {
  id: string;
  content: string;
  _count: {
    replies: number;  // Shows thread count for thread icon
  }
}
```

### 2. Opening a Thread

#### A. Get Thread Details
```typescript
// GET /messages/:threadId/thread/details
interface ThreadDetails {
  threadStarter: {
    id: string;
    content: string;
    user: {
      id: string;
      name: string;
      imageUrl: string;
    };
    reactions: Array<Reaction>;
    _count: {
      replies: number;
    };
  };
  replyCount: number;
  latestReply: Message | null;
}
```

#### B. Get Thread Messages
```typescript
// GET /messages/:threadId/thread?limit=50&cursor=lastMessageId
interface ThreadMessages {
  messages: Array<Message>;
  nextCursor: string | null;
}
```

#### C. Join Real-time Updates
```typescript
// Join thread room
socket.emit('thread:join', {
  threadId: string;
  channelId: string;
});

// Listen for success
socket.on('thread:joined', {
  threadId: string;
  userId: string;
  timestamp: Date;
});
```

### 3. Sending Thread Messages

#### A. Send Reply
```typescript
socket.emit('thread:reply', {
  content: string;     // Message content
  threadId: string;    // Parent message ID
  channelId: string;   // Channel ID
  tempId?: string;     // Client-generated UUID for tracking
});
```

#### B. Handle Responses
```typescript
// Delivery confirmation to sender
socket.on('thread:reply:delivered', {
  messageId: string;   // Server-generated message ID
  threadId: string;    // Parent thread ID
  tempId: string;      // Your original tempId
  status: 'DELIVERED';
  processed: true;
});

// New message notification to all thread participants
socket.on('thread:reply:created', {
  message: Message;    // Full message object with user info
  threadId: string;
  tempId?: string;     // Only set for sender
  processed: true;
});

// Handle failures
socket.on('thread:reply:failed', {
  error: string;
  threadId: string;
  tempId: string;
  status: 'FAILED';
  processed: true;
});

// Thread metadata updates
socket.on('thread:updated', {
  threadId: string;
  replyCount: number;
  lastReply: Message;
  processed: true;
});
```

## Race Condition Prevention

### 1. Message Processing Lock
The server maintains a processing lock for each message to prevent duplicates:
```typescript
const messageKey = `${client.id}:thread:${data.tempId || data.content}`;
if (this.processingMessages.has(messageKey)) {
  return { success: false, error: 'Message already being processed' };
}
```

### 2. Optimistic Updates Pattern
Recommended frontend implementation:
```typescript
function sendThreadReply(content: string) {
  const tempId = generateUUID();
  
  // 1. Optimistic local update
  addMessageLocally({
    tempId,
    content,
    status: 'SENDING'
  });

  // 2. Send with tracking ID
  socket.emit('thread:reply', {
    content,
    threadId,
    channelId,
    tempId
  });

  // 3. Handle confirmation
  socket.on('thread:reply:delivered', (data) => {
    if (data.tempId === tempId) {
      updateMessage(data.messageId, data.message);
    }
  });

  // 4. Handle failures
  socket.on('thread:reply:failed', (data) => {
    if (data.tempId === tempId) {
      handleFailedMessage(tempId);
    }
  });
}
```

### 3. Database Consistency
- All thread operations use database transactions
- Channel access is verified before any thread operation
- Thread messages maintain referential integrity with parent message

## Best Practices

### 1. Message Sending
- Always generate and track tempIds for messages
- Implement retry logic for failed messages
- Show sending status in UI
- Handle offline scenarios gracefully

### 2. Real-time Updates
- Join thread room immediately when opening thread
- Handle reconnection scenarios
- Update thread metadata in channel view when receiving updates
- Clean up socket listeners when closing thread

### 3. Error Handling
```typescript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Implement retry logic or show user feedback
});

socket.on('disconnect', () => {
  // Handle disconnection
  // Show reconnecting status
  // Queue messages for retry
});
```

### 4. Pagination
- Implement infinite scroll using cursor pagination
- Pre-fetch next page when nearing end of current page
- Cache fetched messages to reduce server load
- Update cache when receiving real-time updates

## Type Definitions

### Message Type
```typescript
interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  replyToId?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveryStatus: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  user: {
    id: string;
    name: string;
    imageUrl: string;
  };
  reactions: Array<{
    id: string;
    type: string;
    userId: string;
    user: {
      id: string;
      name: string;
      imageUrl: string;
    };
  }>;
  _count?: {
    replies: number;
  };
}
```

### Socket Event Types
```typescript
interface ThreadJoinPayload {
  threadId: string;
  channelId: string;
}

interface ThreadReplyPayload {
  content: string;
  threadId: string;
  channelId: string;
  tempId?: string;
}

interface ThreadReplyDeliveredPayload {
  messageId: string;
  threadId: string;
  tempId: string;
  status: 'DELIVERED';
  processed: true;
}

interface ThreadReplyCreatedPayload {
  message: Message;
  threadId: string;
  tempId?: string;
  processed: true;
}

interface ThreadUpdatedPayload {
  threadId: string;
  replyCount: number;
  lastReply: Message;
  processed: true;
}
``` 