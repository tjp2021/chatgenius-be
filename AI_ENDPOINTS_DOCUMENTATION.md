# AI-Related Endpoints Documentation

## Authentication
All endpoints require the following headers:
- `X-User-ID`: string - The unique identifier of the user making the request
- `Content-Type`: "application/json" - Specifies the request body format

## Common Types

### MessageContent
```typescript
interface MessageContent {
  id: string;                 // Unique message identifier
  content: string;           // The actual message text
  metadata: {
    channelId: string;      // Channel where message was posted
    userId: string;         // Author of the message
    timestamp: string;      // ISO timestamp of message creation
    scores: {
      semantic: number;     // Semantic relevance score (0-1)
      time: number;        // Time decay score (0-1)
      channel: number;     // Channel boost multiplier
      thread: number;      // Thread context multiplier
      final: number;       // Final weighted score
    }
  };
  score: number;           // Overall relevance score
  user: {
    id: string;           // User identifier
    name: string;         // User's display name
    role: string;         // User's role in the system
  };
  thread?: {              // Optional thread information
    threadId: string;     // Unique thread identifier
    replyCount: number;   // Number of replies in thread
    participantCount: number; // Number of unique participants
    lastActivity: string;    // ISO timestamp of last activity
    status: string;          // Thread status (e.g., "open", "closed")
  };
}
```

### PaginationInfo
```typescript
interface PaginationInfo {
  hasNextPage: boolean;    // Whether more results exist
  cursor?: string;         // Opaque cursor for next page
  total: number;          // Total number of matches
}
```

### SearchMetadata
```typescript
interface SearchMetadata {
  searchTime: number;      // Search execution time in milliseconds
  totalMatches: number;    // Total number of matches found
  contextQuality?: number; // Quality score for RAG context (0-1)
}
```

## Endpoints

### 1. Semantic Search
`POST /search/semantic`

Performs a semantic search across all messages.

#### Request Body
```typescript
interface SemanticSearchRequest {
  query: string;          // Search query text
  limit?: number;         // Max results (default: 10)
  cursor?: string;        // Pagination cursor
  minScore?: number;      // Minimum relevance score (0-1)
  dateRange?: {
    start?: string;      // ISO timestamp
    end?: string;        // ISO timestamp
  };
  sortBy?: {
    field: "score" | "time";
    order: "asc" | "desc";
  };
}
```

#### Response
```typescript
interface SemanticSearchResponse {
  items: MessageContent[];
  metadata: SearchMetadata;
  pageInfo: PaginationInfo;
}
```

### 2. Channel Search
`POST /search/channel/{channelId}`

Searches within a specific channel, including thread messages.

#### Request Body
```typescript
interface ChannelSearchRequest {
  query: string;
  threadOptions?: {
    include: boolean;     // Include thread messages
    expand: boolean;      // Expand thread context
    maxReplies?: number;  // Max thread replies to include
  };
  limit?: number;
  cursor?: string;
  minScore?: number;
  dateRange?: {
    start?: string;
    end?: string;
  };
}
```

#### Response
```typescript
interface ChannelSearchResponse {
  items: MessageContent[];
  metadata: SearchMetadata;
  pageInfo: PaginationInfo;
}
```

### 3. User Search
`POST /search/user/{userId}`

Searches for messages from a specific user.

#### Request Body
```typescript
interface UserSearchRequest {
  query: string;
  limit?: number;
  cursor?: string;
  minScore?: number;
  channelId?: string;    // Filter by channel
  dateRange?: {
    start?: string;
    end?: string;
  };
}
```

#### Response
```typescript
interface UserSearchResponse {
  items: MessageContent[];
  metadata: SearchMetadata;
  pageInfo: PaginationInfo;
}
```

### 4. RAG Search
`POST /search/rag`

Generates AI responses using relevant context from the message history.

#### Request Body
```typescript
interface RAGSearchRequest {
  query: string;           // User's question
  format?: "text" | "markdown" | "html";  // Response format
  maxTokens?: number;      // Max response length
  temperature?: number;    // AI creativity (0-1)
  channelId?: string;      // Limit context to channel
  dateRange?: {
    start?: string;
    end?: string;
  };
}
```

#### Response
```typescript
interface RAGResponse {
  response: string;        // AI-generated response
  contextMessageCount: number;  // Messages used for context
  metadata: {
    searchTime: number;    // Total processing time (ms)
    contextQuality: number; // Context relevance score (0-1)
  };
}
```

## Error Responses
All endpoints may return the following error responses:

### 400 Bad Request
```typescript
{
  statusCode: 400,
  message: string,        // Error description
  errors?: string[]       // Validation errors
}
```

### 401 Unauthorized
```typescript
{
  statusCode: 401,
  message: "Unauthorized. Missing or invalid X-User-ID"
}
```

### 404 Not Found
```typescript
{
  statusCode: 404,
  message: string        // e.g., "Channel not found"
}
```

### 500 Internal Server Error
```typescript
{
  statusCode: 500,
  message: "Internal server error"
}
```

## Rate Limiting
- All endpoints are rate-limited to 100 requests per minute per user
- RAG endpoint is limited to 20 requests per minute per user
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time until limit resets (seconds) 