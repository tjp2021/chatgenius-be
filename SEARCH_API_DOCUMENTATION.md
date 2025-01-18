# Search API Documentation

## Overview
Our search system provides four distinct search types, each optimized for specific use cases. All endpoints require authentication and support basic rate limiting and error handling.

## Common Types

### PaginationInfo
```typescript
{
  hasNextPage: boolean;
  cursor?: string;
  total: number;
}
```

### UserInfo
```typescript
{
  id: string;
  name: string;
  avatar?: string;
  role: string;
}
```

### ThreadInfo
```typescript
{
  threadId: string;
  replyCount: number;
  participantCount: number;
  lastActivity: string;
  status?: 'active' | 'resolved' | 'archived';
}
```

### MessageContent
```typescript
{
  id: string;
  content: string;
  timestamp: string;
  user: UserInfo;
  edited: boolean;
  deleted: boolean;
  reactions?: Array<{
    emoji: string;
    count: number;
    users: UserInfo[];
  }>;
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
  }>;
}
```

## Endpoints

### 1. Semantic Search
`POST /search/semantic`

General-purpose semantic similarity search across all accessible content.

#### Request
```typescript
{
  query: string;              // Search query text
  limit?: number;             // Default: 20
  minScore?: number;          // Default: 0.6
  cursor?: string;            // For pagination
  dateRange?: {
    start: string;           // ISO date
    end: string;            // ISO date
  };
}
```

#### Response
```typescript
{
  items: Array<{
    id: string;              // Message ID
    content: string;         // Message content
    score: number;           // Similarity score (0-1)
    timestamp: string;       // ISO date
    user: UserInfo;         // Author info
    channelId: string;      // Channel ID
    channelName: string;    // Channel name
    threadInfo?: {          // Optional if message is in thread
      threadId: string;
      replyCount: number;
      isParent: boolean;
    };
    highlights?: Array<{    // Relevant text snippets
      text: string;
      score: number;
    }>;
  }>;
  metadata: {
    searchTime: number;     // MS taken
    totalMatches: number;   // Before limit
  };
  pageInfo: PaginationInfo;
}
```

### 2. Channel Search
`POST /search/channel/{channelId}`

Comprehensive search within a channel, including all messages and their associated threads.

#### Request
```typescript
{
  query: string;              // Search query
  limit?: number;             // Default: 50
  minScore?: number;          // Default: 0.5
  cursor?: string;           
  dateRange?: {
    start: string;
    end: string;
  };
  sortBy?: 'relevance' | 'date';  // Default: relevance
  threadOptions?: {
    include: boolean;         // Include thread messages in search
    expand: boolean;          // Auto-expand relevant threads
    maxReplies?: number;      // Max thread replies to return
    scoreThreshold?: number;  // Min score for thread inclusion
  };
  filters?: {
    messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>;
    hasAttachments?: boolean;
    hasReactions?: boolean;
    fromUsers?: string[];
    excludeUsers?: string[];
  };
}
```

#### Response
```typescript
{
  items: Array<{
    message: MessageContent & {
      score: number;          // Relevance score (0-1)
      highlights?: Array<{    // Relevant text snippets
        text: string;
        score: number;
      }>;
      threadInfo?: ThreadInfo;
      thread?: {              // Present if message has thread
        replies: Array<MessageContent & {
          score?: number;     // Present if reply matches search
          replyTo?: string;   // ID of message being replied to
        }>;
        analytics?: {
          averageResponseTime: number;
          peakActivityTime: string;
          participationDistribution: {
            [userId: string]: number;
          };
        };
      };
    };
    context?: {              // Surrounding conversation context
      before: Array<MessageContent>;
      after: Array<MessageContent>;
    };
  }>;
  channelInfo: {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    lastActivity: string;
    type: 'public' | 'private';
  };
  metadata: {
    searchTime: number;
    totalMatches: number;
    threadMatches: number;    // Number of matching thread messages
    searchDepth: {
      messagesScanned: number;
      threadsScanned: number;
    };
  };
  pageInfo: PaginationInfo;
}
```

### 3. User Search
`POST /search/user/{userId}`

Search messages from a specific user across channels.

#### Request
```typescript
{
  query: string;
  limit?: number;             // Default: 30
  channelId?: string;         // Optional channel filter
  includeThreads?: boolean;   // Default: true
  cursor?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  messageTypes?: Array<      // Filter by message type
    'message' | 
    'thread_reply' | 
    'file_share' | 
    'code_snippet'
  >;
}
```

#### Response
```typescript
{
  items: Array<{
    id: string;
    content: string;
    score: number;
    timestamp: string;
    channelId: string;
    channelName: string;
    threadInfo?: ThreadInfo;
    messageType: string;
    engagement: {           // User-specific engagement metrics
      replyCount: number;
      reactionCount: number;
      viewCount: number;
    };
    context?: {            // Surrounding message context
      before: string;
      after: string;
    };
  }>;
  userInfo: {
    id: string;
    name: string;
    role: string;
    joinDate: string;
    activeChannels: Array<{
      id: string;
      name: string;
      messageCount: number;
    }>;
    statistics: {
      totalMessages: number;
      threadsStarted: number;
      repliesReceived: number;
      averageResponseTime: number;
    };
  };
  pageInfo: PaginationInfo;
}
```

### 4. RAG Search
`POST /search/rag`

Generate AI responses using relevant context.

#### Request
```typescript
{
  query: string;
  contextLimit?: number;      // Default: 5
  minContextScore?: number;   // Default: 0.7
  channelId?: string;         // Optional context scope
  dateRange?: {
    start: string;
    end: string;
  };
  responseFormat?: {
    maxLength?: number;
    style?: 'concise' | 'detailed';
    includeQuotes?: boolean;
  };
}
```

#### Response
```typescript
{
  response: string;           // Generated response
  sourcedContexts: Array<{
    content: string;
    score: number;
    source: {
      messageId: string;
      channelId: string;
      channelName: string;
      user: UserInfo;
      timestamp: string;
      threadInfo?: ThreadInfo;
    };
    relevanceExplanation?: string;  // Why this context was chosen
  }>;
  metadata: {
    tokensUsed: number;
    processingTime: number;
    contextQuality: number;   // 0-1 score of context relevance
    modelConfidence: number;  // 0-1 score of response confidence
    followupQuestions?: string[];  // Suggested follow-up questions
  };
  debug?: {                  // Optional debug information
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
    contextSelectionStrategy: string;
    modelParameters: {
      temperature: number;
      topP: number;
      maxTokens: number;
    };
  };
}
```

## Error Handling

All endpoints use standard HTTP status codes and return errors in this format:

```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
  };
}
```

Common error codes:
- `invalid_request`: Malformed request
- `not_found`: Resource not found
- `permission_denied`: Unauthorized access
- `rate_limited`: Too many requests
- `context_not_found`: No relevant context (RAG)
- `generation_failed`: AI generation failed (RAG)

## Rate Limiting

- Default: 100 requests per minute per user
- RAG endpoints: 20 requests per minute per user
- Bulk operations: 5 requests per minute per user

## Authentication

All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Versioning

The API is versioned through the URL:
```
https://api.example.com/v1/search/*
``` 