# Search API Endpoints Documentation

## Authentication
All endpoints require authentication via the `X-User-Id` header.

## Common Headers
```
Content-Type: application/json
Accept: application/json
X-User-Id: string  // Required for authentication
```

## 1. Semantic Search
Search across all messages with semantic understanding.

### Endpoint
```
POST /search/semantic
```

### Request Body
```typescript
{
  query: string,              // Search query text
  filters?: {
    fromUsers?: string[],     // Optional: Filter by specific users
    excludeUsers?: string[]   // Optional: Exclude specific users
  },
  page?: number,              // Optional: Default is 1
  pageSize?: number,          // Optional: Default is 10
  minScore?: number,          // Optional: Minimum relevance score
  cursor?: string,            // Optional: For pagination
  dateRange?: {               // Optional: Filter by date range
    start: string,            // ISO timestamp
    end: string              // ISO timestamp
  }
}
```

### Response
```typescript
{
  items: Array<{
    id: string,
    content: string,
    score: number,
    metadata: {
      channelId: string,
      userId: string,
      timestamp: string,
      scores: {
        semantic: number,     // Base relevance to query
        time: number,        // Time decay factor
        channel: number,     // Channel relevance
        thread: number,      // Thread context relevance
        final: number       // Combined weighted score
      }
    },
    user: {
      id: string,
      name: string,
      role: string
    }
  }>,
  metadata: {
    searchTime: number,      // Processing time in ms
    totalMatches: number    // Total number of matches
  },
  pageInfo: {
    hasNextPage: boolean,
    cursor?: string,
    total: number
  }
}
```

## 2. Channel Search
Search within a specific channel's messages.

### Endpoint
```
POST /search/channel/{channelId}
```

### Request Body
```typescript
{
  query: string,
  filters?: {
    fromUsers?: string[],
    excludeUsers?: string[],
    messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>,
    hasAttachments?: boolean,
    hasReactions?: boolean
  },
  limit?: number,
  minScore?: number,
  cursor?: string,
  dateRange?: {
    start: string,
    end: string
  },
  sortBy?: 'relevance' | 'date',
  threadOptions?: {
    include: boolean,        // Include thread messages
    expand: boolean,         // Expand thread context
    maxReplies?: number,     // Max thread replies to include
    scoreThreshold?: number  // Minimum score for thread messages
  }
}
```

### Response
Same format as semantic search response.

## 3. User Search
Search messages from a specific user.

### Endpoint
```
POST /search/user/{userId}
```

### Request Body
```typescript
{
  query: string,
  limit?: number,
  channelId?: string,         // Optional: Filter by channel
  includeThreads?: boolean,   // Include thread messages
  cursor?: string,
  dateRange?: {
    start: string,
    end: string
  },
  messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>
}
```

### Response
Same format as semantic search response.

## 4. RAG Search
Generate AI responses using context from all workspace messages.

### Endpoint
```
POST /search/rag
```

### Request Body
```typescript
{
  query: string,
  contextLimit?: number,      // Optional: Max number of context messages to use
  minContextScore?: number,   // Optional: Minimum relevance score for context
  channelId?: string,        // Optional: Limit context to specific channel
  dateRange?: {              // Optional: Filter context by date range
    start: string,
    end: string
  },
  responseFormat?: {         // Optional: Control response format
    maxLength?: number,
    style?: 'concise' | 'detailed',
    includeQuotes?: boolean
  }
}
```

### Response
```typescript
{
  response: string,           // AI-generated response
  contextMessageCount: number, // Number of messages used as context
  metadata?: {
    searchTime: number,       // Processing time in ms
    contextQuality: number    // Quality score of context (0-1)
  }
}
```

## Important Notes

### Scoring System
- All search endpoints use a weighted scoring system combining:
  - Semantic relevance (80% weight)
  - Time decay (10% weight)
  - Channel relevance (5% weight)
  - Thread context (5% weight)
- Minimum score defaults can be overridden using `minScore` parameter
- RAG search uses additional quality checks for context selection

### Pagination
- All search endpoints support cursor-based pagination
- Semantic search additionally supports page-based pagination
- Default page size is 10 items
- Maximum page size is 50 items

### Filtering
- User filtering is available in semantic and channel search
- RAG search intentionally searches across all messages for comprehensive responses
- Date range filtering is consistent across all endpoints
- Channel-specific searches include additional thread context options

### Performance Considerations
- Use channel filters when possible to improve response times
- Limit context size in RAG searches for faster responses
- Consider using cursor-based pagination for large result sets 