# Search API Documentation

## Endpoint: POST /search

This endpoint provides unified search functionality including semantic search, RAG, and filtered searches.

## Authentication
```http
Authorization: Bearer YOUR_TOKEN
x-user-id: required_user_id
```

## Request Format

### Base Request Structure
```typescript
{
  query: string;        // Required: Search query or command
  limit?: number;       // Optional: Results per page (default: 10)
  cursor?: string;      // Optional: Pagination cursor
  minScore?: number;    // Optional: Minimum relevance score (0-1)
  channelId?: string;   // Optional: Specific channel to search
}
```

## Query Types and Examples

### 1. Direct Semantic Search
```typescript
// Request
{
  "query": "deployment issues with kubernetes",
  "limit": 10,
  "minScore": 0.7
}

// Response
{
  "items": [
    {
      "id": "msg_123",
      "content": "We're seeing pod scheduling issues in production",
      "score": 0.89,
      "metadata": {
        "channelId": "channel_456",
        "userId": "user_789",
        "timestamp": 1707824461,
        "replyToId": null,
        "threadId": null
      }
    }
  ],
  "pageInfo": {
    "hasNextPage": true,
    "endCursor": "cursor_xyz"
  },
  "total": 45
}
```

### 2. Channel-Specific Search (/in command)
```typescript
// Request
{
  "query": "/in channel_123 deployment issues",
  "limit": 5
}

// Response
{
  "items": [
    {
      "id": "msg_456",
      "content": "Fixed the deployment configuration",
      "score": 0.92,
      "metadata": {
        "channelId": "channel_123",
        "userId": "user_789",
        "timestamp": 1707824461
      }
    }
  ],
  "pageInfo": {
    "hasNextPage": false
  },
  "total": 1
}
```

### 3. Text Search (/text command)
```typescript
// Request
{
  "query": "/text deployment",
  "limit": 10
}

// Response
{
  "items": [
    {
      "id": "msg_789",
      "content": "New deployment process document",
      "score": 1.0,  // Exact match score
      "metadata": {
        "channelId": "channel_456",
        "userId": "user_123",
        "timestamp": 1707824461
      }
    }
  ],
  "pageInfo": {
    "hasNextPage": false
  },
  "total": 1
}
```

### 4. RAG Search (/rag command)
```typescript
// Request
{
  "query": "/rag What were the recent deployment issues?",
  "limit": 5
}

// Response
{
  "response": "Based on recent discussions, there were three main deployment issues: 1) Pod scheduling problems in production, 2) Resource limit constraints, and 3) Configuration mismatches between staging and production environments. The team implemented horizontal pod autoscaling and updated the resource quotas to address these issues.",
  "type": "rag",
  "context": {
    "messages": [
      {
        "id": "msg_123",
        "content": "Pod scheduling issues detected",
        "score": 0.92
      }
    ],
    "sourceCount": 1
  }
}
```

### 5. User-Specific Search (/from command)
```typescript
// Request
{
  "query": "/from user_123 deployment",
  "limit": 5
}

// Response
{
  "items": [
    {
      "id": "msg_321",
      "content": "Updated the deployment scripts",
      "score": 0.88,
      "metadata": {
        "channelId": "channel_456",
        "userId": "user_123",
        "timestamp": 1707824461
      }
    }
  ],
  "pageInfo": {
    "hasNextPage": false
  },
  "total": 1
}
```

### 6. Thread Search (/thread command)
```typescript
// Request
{
  "query": "/thread msg_123",
  "limit": 10
}

// Response
{
  "items": [
    {
      "id": "msg_123",
      "content": "Initial deployment issue",
      "metadata": {
        "channelId": "channel_456",
        "userId": "user_789",
        "timestamp": 1707824461,
        "threadId": "thread_123"
      }
    },
    {
      "id": "msg_124",
      "content": "Reply with solution",
      "metadata": {
        "channelId": "channel_456",
        "userId": "user_789",
        "timestamp": 1707824462,
        "threadId": "thread_123",
        "replyToId": "msg_123"
      }
    }
  ],
  "pageInfo": {
    "hasNextPage": false
  },
  "total": 2
}
```

## Error Responses

### 1. Authentication Error
```typescript
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "No user ID provided"
}
```

### 2. Invalid Query
```typescript
{
  "statusCode": 400,
  "message": "Invalid search query",
  "error": "Bad Request",
  "details": {
    "reason": "Query must be at least 3 characters"
  }
}
```

### 3. Invalid Command
```typescript
{
  "statusCode": 400,
  "message": "Invalid command format",
  "error": "Bad Request",
  "details": {
    "command": "unknown_command",
    "supportedCommands": ["in", "text", "rag", "from", "thread"]
  }
}
```

## Pagination

- Use `limit` to control page size
- Use `cursor` from `pageInfo.endCursor` for next page
- Check `pageInfo.hasNextPage` to determine if more results exist

## Score Interpretation

- 0.9 - 1.0: Excellent match
- 0.8 - 0.9: Good match
- 0.7 - 0.8: Moderate match
- < 0.7: Poor match

## Rate Limiting

- 100 requests per minute per user
- 1000 requests per hour per user
- RAG queries count as 5 regular queries

## Best Practices

1. **Query Construction**:
   - Use specific commands for specific needs
   - Prefer semantic search for concept matching
   - Use text search for exact matches
   - Use RAG for summarization or analysis

2. **Performance**:
   - Keep `limit` reasonable (5-20)
   - Use channel filters when possible
   - Cache common searches client-side

3. **Error Handling**:
   - Always check response status
   - Implement retry logic for 429 (Rate Limit)
   - Handle 401/403 with auth refresh 