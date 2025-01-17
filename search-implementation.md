# Search Implementation Plan

## Current State
- We have `/messages/search` for semantic search
- RAG functionality exists in `AiService`
- Vector search capabilities in `VectorStoreService`

## New Design
### Single Endpoint: `/search`
- Replaces `/messages/search`
- Handles both direct queries and command-based queries
- Backend handles command detection and processing

### Request Format
```typescript
{
  query: string;     // Can be direct ("basketball") or command ("/rag summarize basketball")
  limit?: number;    // Pagination
  cursor?: string;   // Pagination
  minScore?: number; // Relevance threshold
}
```

### Response Format
1. Direct Search Response:
```typescript
{
  items: Array<{
    id: string;
    content: string;
    score: number;
    metadata: {
      channelId: string;
      userId: string;
      timestamp: string;
    }
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

## Next Steps
1. Create minimal `search.controller.ts`
2. Implement basic command detection
3. Test with existing services
4. Once working, deprecate `/messages/search` 