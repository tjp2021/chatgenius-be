# Workspace-Wide RAG System Implementation

## Overview
Our RAG (Retrieval-Augmented Generation) system provides semantic search capabilities across the entire workspace, with features for context-aware retrieval and relevance scoring.

## Core Components

### 1. Vector Storage System
- Messages are automatically vectorized and stored in Pinecone
- Each message is chunked appropriately to maintain semantic meaning
- Metadata includes:
  - channelId
  - userId
  - timestamp
  - threadId (if part of a thread)
  - replyTo (for thread context)

## Search Endpoints

### 1. Main Search Endpoint
```typescript
POST /search
{
  "query": string,      // Search query or command
  "limit"?: number,     // Optional: Max results
  "cursor"?: string,    // Optional: Pagination cursor
  "minScore"?: number   // Optional: Minimum relevance score
}
```

1. Direct Query Response:
```typescript
{
  items: Array<{
    id: string;
    content: string;
    score: number;
    user: {
      id: string;
      name: string;
      imageUrl: string;
    };
    replyTo?: {
      id: string;
      content: string;
      user: {
        id: string;
        name: string;
        imageUrl: string;
      };
    };
  }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  total: number;
}
```

2. RAG Command Response:
```typescript
{
  response: string;  // AI-generated response
  context: {
    messages: Array<{
      id: string;
      content: string;
      score: number;
    }>;
    sourceCount: number;
  };
  command: {
    type: 'rag';
    action: string;
    query: string;
  }
}
```

## Implementation Location
- New `search.controller.ts` in `src/controllers`
- Leverages existing:
  - `AiService` for RAG processing
  - `VectorStoreService` for semantic search
  - `MessagesService` for message retrieval

## Why This Approach
1. **Single Responsibility**: One endpoint for all search functionality
2. **Backend Command Parsing**: 
   - Single source of truth for command detection
   - Frontend remains simple
   - Command syntax can evolve without frontend changes
3. **Clear Response Contracts**: 
   - Different response shapes for different query types
   - Frontend knows exactly what data to expect
4. **Future Extensibility**:
   - Easy to add new command types
   - Can add file search capabilities
   - Maintains clean separation of concerns

### 3. Scoring System
Messages are scored based on multiple factors:
1. Semantic Similarity (originalScore)
2. Time Relevance (timeScore)
3. Thread Context (threadScore)
4. Channel Relevance (channelScore)

The final score is a weighted combination of these factors.

## Frontend Integration Guide

### 1. Message Storage
Messages are automatically vectorized when created through the `/messages` POST endpoint. No additional action required from frontend.

### 2. Implementing Search
#### Basic Search Example
```typescript
const searchMessages = async (query: string, channelId?: string) => {
  const response = await fetch('/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'YOUR_AUTH_TOKEN'
    },
    body: JSON.stringify({
      query,
      channelId
    })
  });
  return await response.json();
};
```

#### AI-Enhanced Search Example
```typescript
const searchWithAI = async (query: string, options?: {
  userId?: string,
  channelId?: string,
  limit?: number
}) => {
  const response = await fetch('/ai/messages/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'YOUR_AUTH_TOKEN'
    },
    body: JSON.stringify({
      query,
      ...options
    })
  });
  return await response.json();
};
```

### 3. Handling Search Results
Results include rich metadata that can be used to:
- Display relevance scores
- Group messages by thread
- Sort by time or relevance
- Filter by channel or user

Example:
```typescript
interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    userId: string;
    channelId: string;
    timestamp: string;
    replyTo?: string;
    originalScore: number;
    timeScore: number;
    threadScore: number;
    channelScore: number;
  };
}

// Group results by thread
const groupByThread = (results: SearchResult[]) => {
  const threads = new Map();
  results.forEach(result => {
    const threadId = result.metadata.replyTo || result.id;
    if (!threads.has(threadId)) {
      threads.set(threadId, []);
    }
    threads.get(threadId).push(result);
  });
  return threads;
};
```

## Testing
The system includes comprehensive tests:
1. Basic RAG functionality (storing and retrieving messages)
2. Context-aware retrieval (thread relationships)
3. Time-based scoring
4. Channel-specific searches

Use the test endpoint `/avatars/test/message` for validating vector storage:
```typescript
POST /avatars/test/message
{
  "content": string,
  "channelId": string,
  "userId": string
}
```

## Current Limitations
1. Maximum message length for vectorization
2. Rate limits on embedding generation
3. Fixed scoring weights (not dynamically adjusted)

## Future Enhancements
1. Adaptive scoring weights based on usage patterns
2. Caching frequently accessed vectors
3. Enhanced thread context awareness
4. Real-time search updates 