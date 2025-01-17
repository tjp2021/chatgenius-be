# Vector Search Integration Guide

## Overview
This document describes how to integrate the vector search system with the frontend. The system is designed to provide semantic search capabilities over Slack messages, enabling RAG (Retrieval-Augmented Generation) functionality.

## Core Components

### 1. Vector Storage Configuration
```typescript
// Required environment variables
PINECONE_API_KEY=your_api_key
PINECONE_INDEX_NAME=chatgenius-1536  // DO NOT CHANGE
OPENAI_API_KEY=your_api_key

// Pinecone SDK Version
"@pinecone-database/pinecone": "^4.1.0"  // MUST use this version
```

### 2. Message Format
Messages stored in the vector database have the following metadata structure:
```typescript
interface MessageMetadata {
  messageId: string;      // Unique message identifier
  channelId: string;      // Channel the message belongs to
  userId: string;         // User who sent the message
  timestamp: number;      // Unix timestamp
  replyToId?: string;    // Optional: ID of parent message in thread
  content: string;       // Message text content
  chunkIndex?: number;   // Optional: Position in chunked message
}
```

### 3. Search Types & Filters

#### Basic Semantic Search
```typescript
// No filters, pure semantic search
const options = {};
```

#### Channel-Filtered Search
```typescript
// Search within specific channel
const options = {
  filter: { 
    channelId: { $eq: 'channel_id' } 
  }
};
```

#### Multi-Channel Search
```typescript
// Search across multiple channels
const options = {
  filter: { 
    channelId: { $in: ['channel_1', 'channel_2'] } 
  }
};
```

#### RAG Context Search
```typescript
// Get more context for RAG
const options = {
  topK: 10  // Adjust based on needs
};
```

### 4. Score Interpretation
- >0.85: Highly relevant
- 0.80-0.85: Relevant
- 0.75-0.80: Somewhat relevant
- <0.75: Likely irrelevant

## Integration Steps

### 1. Setup Vector Search Service
```typescript
// VectorSearchService.ts
import { Pinecone } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

export class VectorSearchService {
  private pinecone: Pinecone;
  private openai: OpenAI;
  private readonly indexName: string;

  constructor(configService: ConfigService) {
    this.pinecone = new Pinecone({
      apiKey: configService.get<string>('PINECONE_API_KEY')
    });
    this.openai = new OpenAI({
      apiKey: configService.get<string>('OPENAI_API_KEY')
    });
    this.indexName = configService.get<string>('PINECONE_INDEX_NAME');
  }

  async searchMessages(query: string, options: SearchOptions = {}) {
    // Create embedding
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    const searchVector = response.data[0].embedding;

    // Query Pinecone
    const index = this.pinecone.index(this.indexName);
    const results = await index.query({
      vector: searchVector,
      topK: options.topK || 5,
      includeMetadata: true,
      filter: options.filter
    });

    return this.formatResults(results);
  }
}
```

### 2. API Endpoints

#### Search Endpoint
```typescript
// search.controller.ts
@Post('search')
async search(@Body() dto: SearchDto) {
  const results = await this.vectorSearchService.searchMessages(
    dto.query,
    {
      topK: dto.topK,
      filter: dto.filter
    }
  );
  return results;
}
```

#### Search DTO
```typescript
// search.dto.ts
export class SearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  topK?: number;

  @IsOptional()
  @IsObject()
  filter?: Record<string, any>;
}
```

### 3. Frontend Integration

#### Search Service
```typescript
// search.service.ts
export class SearchService {
  constructor(private http: HttpClient) {}

  async search(query: string, options: SearchOptions = {}) {
    return this.http.post('/api/search', {
      query,
      ...options
    }).pipe(
      map(response => this.formatResponse(response))
    );
  }
}
```

#### Usage in Components
```typescript
// search.component.ts
@Component({
  selector: 'app-search',
  template: `
    <div>
      <input [(ngModel)]="searchQuery" />
      <button (click)="search()">Search</button>
      
      <div *ngFor="let result of results">
        <div>Score: {{ result.score }}</div>
        <div>Content: {{ result.content }}</div>
        <div>Channel: {{ result.channelId }}</div>
      </div>
    </div>
  `
})
export class SearchComponent {
  constructor(private searchService: SearchService) {}

  async search() {
    const results = await this.searchService.search(
      this.searchQuery,
      {
        topK: 5,
        filter: {
          channelId: { $eq: this.currentChannel }
        }
      }
    );
    this.results = results;
  }
}
```

## Important Notes

### 1. Performance Considerations
- Keep `topK` reasonable (5-10 for most cases)
- Use channel filters when possible
- Cache common searches if needed

### 2. Error Handling
```typescript
try {
  const results = await searchService.search(query);
} catch (error) {
  if (error instanceof PineconeBadRequestError) {
    // Handle invalid query/filter
  } else if (error instanceof OpenAIError) {
    // Handle embedding creation errors
  }
}
```

### 3. Rate Limiting
- OpenAI: Monitor embedding API usage
- Pinecone: Monitor query usage
- Implement retry logic for failures

### 4. Security
- Never expose API keys to frontend
- Validate user permissions for channel access
- Sanitize search queries

## Testing

### 1. Unit Tests
```typescript
describe('VectorSearchService', () => {
  it('should return relevant results', async () => {
    const results = await service.searchMessages('test query');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0.75);
  });
});
```

### 2. Integration Tests
```typescript
describe('Search API', () => {
  it('should handle search requests', async () => {
    const response = await request(app)
      .post('/api/search')
      .send({
        query: 'test query',
        topK: 5
      });
    expect(response.status).toBe(200);
    expect(response.body.results).toBeDefined();
  });
});
```

## Troubleshooting

### Common Issues
1. No results
   - Check query length
   - Verify channel filters
   - Confirm index has data

2. Low relevance scores
   - Review query formatting
   - Check embedding quality
   - Verify data chunking

3. Performance issues
   - Reduce `topK`
   - Add channel filters
   - Check network latency

## Support
For issues with:
- Vector search: Check Pinecone logs
- Embeddings: Verify OpenAI API status
- Integration: Review API responses 

## API Response Structures

### Search Response
```typescript
interface SearchResponse {
  results: SearchResult[];
  metadata: SearchMetadata;
}

interface SearchResult {
  id: string;                // Unique identifier for the message
  content: string;           // Message content
  score: number;            // Similarity score (0-1)
  metadata: MessageMetadata;
  vector?: number[];        // Optional embedding vector
}

interface MessageMetadata {
  messageId: string;        // Original message ID
  channelId: string;        // Channel where message was posted
  userId: string;           // User who sent the message
  timestamp: number;        // Unix timestamp
  replyToId?: string;      // Parent message ID if in thread
  threadId?: string;       // Thread ID if part of thread
  chunkIndex?: number;     // Position in chunked message
}

interface SearchMetadata {
  totalResults: number;     // Total number of matches
  searchTime: number;       // Time taken in ms
  indexName: string;       // Pinecone index used
  filter?: any;            // Applied filters if any
}

### Error Response
```typescript
interface ErrorResponse {
  error: string;           // Error message
  code: string;           // Error code
  details?: any;          // Additional error details
  status: number;         // HTTP status code
}

// Common error codes:
type ErrorCode = 
  | 'INVALID_QUERY'           // Query format invalid
  | 'EMBEDDING_FAILED'        // Could not create embedding
  | 'SEARCH_FAILED'          // Vector search failed
  | 'UNAUTHORIZED'           // Missing/invalid auth
  | 'RATE_LIMITED'          // Too many requests
  | 'INTERNAL_ERROR';       // Server error
```

### Example Successful Response
```json
{
  "results": [
    {
      "id": "msg_123",
      "content": "Discussion about deployment issues",
      "score": 0.89,
      "metadata": {
        "messageId": "msg_123",
        "channelId": "channel_456",
        "userId": "user_789",
        "timestamp": 1707824461,
        "replyToId": null,
        "threadId": null
      }
    }
  ],
  "metadata": {
    "totalResults": 1,
    "searchTime": 156,
    "indexName": "chatgenius-1536",
    "filter": {
      "channelId": { "$eq": "channel_456" }
    }
  }
}
```

### Example Error Response
```json
{
  "error": "Failed to create embedding",
  "code": "EMBEDDING_FAILED",
  "details": {
    "reason": "OpenAI API error",
    "query": "original search query"
  },
  "status": 500
}
``` 