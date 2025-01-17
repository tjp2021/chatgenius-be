# RAG Integration Guide

## Overview
This document describes how to integrate the RAG (Retrieval-Augmented Generation) system with our existing AI chat functionality.

## Core Components

### 1. Message Retrieval
```typescript
interface RAGOptions {
  query: string;           // User's question
  channelId?: string;      // Optional channel context
  messageId?: string;      // Optional message context
  topK?: number;          // Number of relevant messages to retrieve
}

interface RAGContext {
  messages: Message[];     // Retrieved relevant messages
  scores: number[];       // Relevance scores
  channels: string[];     // Channels involved
}
```

### 2. Context Formation
```typescript
interface PromptContext {
  relevantMessages: string[];  // Retrieved messages
  userQuestion: string;       // Current question
  channelContext?: string;    // Optional channel info
}

// Example context template
const contextTemplate = `
Based on the following conversation history:
${relevantMessages.join('\n')}

Please answer the question: ${userQuestion}
`;
```

### 3. Integration Points

#### A. Message Handler
```typescript
// message.service.ts
export class MessageService {
  constructor(
    private vectorSearch: VectorSearchService,
    private aiService: AIService
  ) {}

  async handleMessage(message: Message): Promise<Response> {
    // 1. Get relevant context
    const context = await this.vectorSearch.searchMessages(
      message.content,
      {
        topK: 5,
        filter: {
          channelId: { $eq: message.channelId }
        }
      }
    );

    // 2. Format context for AI
    const prompt = this.formatRAGPrompt(context, message);

    // 3. Get AI response
    return this.aiService.getResponse(prompt);
  }

  private formatRAGPrompt(context: RAGContext, message: Message): string {
    return `
Based on these relevant messages:
${context.messages.map(m => `- ${m.content}`).join('\n')}

Answer this question: ${message.content}
    `.trim();
  }
}
```

#### B. AI Service Integration
```typescript
// ai.service.ts
export class AIService {
  async getResponse(prompt: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant with access to conversation history.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content;
  }
}
```

## Usage Examples

### 1. Basic RAG Query
```typescript
// Example usage in a component
async function handleUserQuestion(question: string) {
  // 1. Get relevant context
  const context = await vectorSearch.searchMessages(question);

  // 2. Format prompt with context
  const prompt = formatPrompt(context, question);

  // 3. Get AI response
  const response = await aiService.getResponse(prompt);

  return response;
}
```

### 2. Channel-Aware RAG
```typescript
async function handleChannelQuestion(question: string, channelId: string) {
  const context = await vectorSearch.searchMessages(question, {
    filter: { channelId: { $eq: channelId } }
  });

  const prompt = formatPrompt(context, question, channelId);
  return aiService.getResponse(prompt);
}
```

### 3. Thread-Aware RAG
```typescript
async function handleThreadQuestion(question: string, threadId: string) {
  // Get thread context
  const context = await vectorSearch.searchMessages(question, {
    filter: { 
      $or: [
        { messageId: threadId },
        { replyToId: threadId }
      ]
    }
  });

  const prompt = formatPrompt(context, question);
  return aiService.getResponse(prompt);
}
```

## Important Considerations

### 1. Context Management
- Keep context relevant (use high similarity scores)
- Limit context size (watch token limits)
- Preserve message order when relevant

### 2. Performance
- Cache common queries
- Use channel filters
- Implement rate limiting

### 3. Error Handling
```typescript
try {
  const context = await getRAGContext(query);
  const response = await getAIResponse(context);
} catch (error) {
  if (error instanceof ContextRetrievalError) {
    return 'I couldn\'t find relevant information to answer your question.';
  }
  if (error instanceof AIError) {
    return 'I\'m having trouble processing your request.';
  }
}
```

## Testing RAG Integration

### 1. Context Retrieval Tests
```typescript
describe('RAG Context', () => {
  it('should retrieve relevant context', async () => {
    const context = await getRAGContext('test query');
    expect(context.messages.length).toBeGreaterThan(0);
    expect(context.scores[0]).toBeGreaterThan(0.8);
  });
});
```

### 2. Response Quality Tests
```typescript
describe('RAG Responses', () => {
  it('should provide contextual answers', async () => {
    const response = await handleQuestion(
      'What was discussed about deployment issues?'
    );
    expect(response).toContain('deployment');
  });
});
```

## Troubleshooting

### Common Issues
1. Poor response quality
   - Check context relevance scores
   - Verify prompt formatting
   - Review AI temperature setting

2. Slow responses
   - Reduce context size
   - Add caching
   - Use channel filters

3. Missing context
   - Verify vector search
   - Check channel access
   - Review message indexing

## Support
- Vector issues: Check Pinecone dashboard
- AI issues: Review OpenAI logs
- Context issues: Verify message indexing 

## API Response Structures

### RAG Response
```typescript
interface RAGResponse {
  answer: string;            // AI-generated answer
  context: RAGContext;       // Retrieved context used
  metadata: RAGMetadata;     // Additional metadata
}

interface RAGContext {
  messages: ContextMessage[];  // Retrieved messages used for context
  scores: number[];           // Relevance scores for messages
  channels: string[];         // Channels involved
}

interface ContextMessage {
  id: string;                // Message ID
  content: string;           // Message content
  metadata: MessageMetadata; // Message metadata
  score: number;            // Relevance score
}

interface MessageMetadata {
  messageId: string;        // Original message ID
  channelId: string;        // Channel where message was posted
  userId: string;           // User who sent the message
  timestamp: number;        // Unix timestamp
  replyToId?: string;      // Parent message ID if in thread
  threadId?: string;       // Thread ID if part of thread
}

interface RAGMetadata {
  processingTime: number;   // Total processing time in ms
  tokensUsed: number;      // Total tokens consumed
  model: string;           // AI model used
  contextSize: number;     // Number of context messages used
}

### Error Response
```typescript
interface RAGErrorResponse {
  error: string;           // Error message
  code: RAGErrorCode;      // Error code
  details?: any;          // Additional error details
  status: number;         // HTTP status code
}

type RAGErrorCode = 
  | 'CONTEXT_RETRIEVAL_FAILED'  // Could not get relevant context
  | 'AI_GENERATION_FAILED'      // AI response generation failed
  | 'INVALID_QUERY'            // Query format invalid
  | 'UNAUTHORIZED'             // Missing/invalid auth
  | 'RATE_LIMITED'            // Too many requests
  | 'INTERNAL_ERROR';         // Server error
```

### Example Successful Response
```json
{
  "answer": "Based on the conversation history, deployment issues were discussed on January 15th. The main problems identified were pod scheduling and resource limits. The team implemented horizontal pod autoscaling as a solution.",
  "context": {
    "messages": [
      {
        "id": "msg_123",
        "content": "We're seeing pod scheduling issues in production",
        "metadata": {
          "messageId": "msg_123",
          "channelId": "devops",
          "userId": "user_789",
          "timestamp": 1705334400,
          "threadId": "thread_456"
        },
        "score": 0.92
      }
    ],
    "scores": [0.92],
    "channels": ["devops"]
  },
  "metadata": {
    "processingTime": 2150,
    "tokensUsed": 428,
    "model": "gpt-4-turbo-preview",
    "contextSize": 1
  }
}
```

### Example Error Response
```json
{
  "error": "Failed to generate AI response",
  "code": "AI_GENERATION_FAILED",
  "details": {
    "reason": "OpenAI API error",
    "query": "What deployment issues were discussed?",
    "contextSize": 3
  },
  "status": 500
}
``` 