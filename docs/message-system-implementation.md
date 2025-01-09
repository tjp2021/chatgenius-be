# Message System Implementation Plan

## Overview
This document outlines the implementation plan for a unified message system that works across all channel types (Public, Private, and DMs) in the ChatGenius backend.

## Core Principles
- Messages are always within channel context
- Consistent features across all channel types
- Real-time updates via WebSocket
- Proper access control and validation
- Efficient caching strategy

## 1. Database Schema

### Message Core
```prisma
model Message {
  id          String      @id @default(cuid())
  content     String
  channelId   String
  userId      String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  // Threading
  parentId    String?     // For thread replies
  parent      Message?    @relation("ThreadReplies", fields: [parentId], references: [id])
  replies     Message[]   @relation("ThreadReplies")
  replyCount  Int         @default(0)
  
  // Relations
  channel     Channel     @relation(fields: [channelId], references: [id])
  user        User        @relation(fields: [userId], references: [id])
  
  // Features
  reactions   Reaction[]
  readBy      ReadReceipt[]
  attachments Attachment[]
}
```

### Supporting Models
```prisma
model Reaction {
  id        String   @id @default(cuid())
  emoji     String   // Unicode emoji
  messageId String
  userId    String
  createdAt DateTime @default(now())
  message   Message  @relation(fields: [messageId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
}

model ReadReceipt {
  id        String   @id @default(cuid())
  messageId String
  userId    String
  readAt    DateTime @default(now())
  message   Message  @relation(fields: [messageId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
}

model Attachment {
  id        String   @id @default(cuid())
  messageId String
  url       String
  type      String   // "image", "file", etc.
  message   Message  @relation(fields: [messageId], references: [id])
}
```

## 2. API Structure

### Message Endpoints
All message operations happen within channel context:

```typescript
@Controller('channels')
class ChannelsController {
  // Core Message Operations
  @Post(':channelId/messages')              // Create message
  @Get(':channelId/messages')               // List messages
  @Put(':channelId/messages/:messageId')    // Edit message
  @Delete(':channelId/messages/:messageId')  // Delete message

  // Threading
  @Get(':channelId/messages/:messageId/thread')  // Get thread
  @Post(':channelId/messages/:messageId/reply')  // Reply to thread

  // Reactions
  @Post(':channelId/messages/:messageId/reactions')  // Add reaction
  @Delete(':channelId/messages/:messageId/reactions/:reactionId') // Remove reaction

  // Read Status
  @Post(':channelId/messages/:messageId/read')  // Mark as read
  @Get(':channelId/messages/:messageId/read')   // Get read receipts

  // Typing Indicators
  @Post(':channelId/typing')
  @Get(':channelId/typing')
}
```

## 3. Socket Events

### Event Interface
```typescript
interface MessageEvents {
  // Emitted Events (server -> client)
  'message:new': Message
  'message:updated': Message
  'message:deleted': { messageId: string, channelId: string }
  'message:reaction': { messageId: string, reaction: Reaction }
  'message:read': { messageId: string, readReceipt: ReadReceipt }
  'channel:typing': { channelId: string, userId: string, isTyping: boolean }

  // Received Events (client -> server)
  'message:send': { channelId: string, content: string }
  'message:startTyping': { channelId: string }
  'message:stopTyping': { channelId: string }
}
```

## 4. Implementation Phases

### Phase 1: Core Message Functionality
1. Database schema updates
2. Basic CRUD endpoints
3. Message validation
4. Access control
5. Socket event foundation

### Phase 2: Threading
1. Thread creation/retrieval
2. Reply management
3. Thread counts
4. Thread notifications

### Phase 3: Reactions & Read Receipts
1. Reaction management
2. Read status tracking
3. Read receipt queries
4. Real-time updates

### Phase 4: Rich Features
1. File attachments
2. Typing indicators
3. Message search
4. Advanced querying

## 5. Key Implementation Details

### Access Control
```typescript
async validateMessageAccess(channelId: string, userId: string) {
  const membership = await this.prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId
      }
    }
  });
  
  if (!membership) {
    throw new ForbiddenException('Not a member of this channel');
  }
}
```

### Cache Strategy
```typescript
// Cache keys
const MESSAGE_LIST_KEY = (channelId: string) => `messages:${channelId}`;
const MESSAGE_KEY = (messageId: string) => `message:${messageId}`;
const THREAD_KEY = (messageId: string) => `thread:${messageId}`;
```

### Real-time Updates
```typescript
// After message creation
async createMessage(channelId: string, userId: string, content: string) {
  // 1. Validate access
  await this.validateMessageAccess(channelId, userId);
  
  // 2. Create message
  const message = await this.prisma.message.create({...});
  
  // 3. Emit socket event
  this.socketGateway.emitToChannel(channelId, 'message:new', message);
  
  // 4. Invalidate caches
  await this.cacheService.invalidate(MESSAGE_LIST_KEY(channelId));
  
  // 5. Return message
  return message;
}
```

## 6. Testing Strategy

### Unit Tests
- Message CRUD operations
- Access control validation
- Cache management
- Event emission

### Integration Tests
- Real-time message delivery
- Thread management
- Reaction handling
- Read receipt tracking

### Load Tests
- Message retrieval performance
- Concurrent reactions
- Thread scaling
- Cache effectiveness

### Concurrency Tests
- Multiple simultaneous reactions
- Parallel read receipts
- Race condition prevention
- Thread reply ordering

## 7. Monitoring and Logging

### Key Metrics
- Message delivery latency
- Socket connection stability
- Cache hit/miss rates
- Database query performance

### Log Points
- Message creation/updates
- Access violations
- Cache invalidations
- Socket reconnections

## 8. Error Handling

### Common Scenarios
1. Channel access denied
2. Message not found
3. Invalid reaction
4. Socket disconnection
5. Cache inconsistency

### Error Response Format
```typescript
interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}
```

## 9. Future Considerations

### Scalability
- Message pagination
- Efficient thread loading
- Reaction aggregation
- Read receipt optimization

### Feature Extensions
- Message editing history
- Rich text support
- File preview generation
- Advanced search capabilities 