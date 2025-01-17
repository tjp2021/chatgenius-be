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

### 2. Search Functionality
The system provides two main search endpoints:

#### Basic Search Endpoint
```typescript
POST /search
{
  "query": string,
  "channelId"?: string  // Optional: Filter by channel
}
```
Returns:
```typescript
{
  "results": [{
    "id": string,
    "content": string,
    "score": number,
    "metadata": {
      "userId": string,
      "channelId": string,
      "timestamp": string,
      "replyTo"?: string,
      "originalScore": number,
      "timeScore": number,
      "threadScore": number,
      "channelScore": number
    }
  }]
}
```

#### AI-Enhanced Search Endpoint
```typescript
POST /ai/messages/search
{
  "query": string,
  "userId"?: string,    // Optional: Filter by user
  "channelId"?: string, // Optional: Filter by channel
  "limit"?: number      // Optional: Limit results
}
```

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