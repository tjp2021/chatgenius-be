# RAG (Retrieval Augmented Generation) Concepts

## Multi-Message Aggregation & Context Chain
- Currently, when we search for relevant messages, we only get individual messages and their direct parent (if it's a reply)
- A context chain is a sequence of related messages that form a conversation thread
- Example:
```
Message 1: "How do I set up my API key?"
Message 2: "Go to settings"
Message 3: "I don't see it in settings"
Message 4: "It's under Developer Settings > API Keys"
```
Even if Message 4 is the most relevant to a search, we want to capture Messages 1-3 to understand the full context.

## Contextual Relevance Scoring
Current scoring implementation includes:
```typescript
private calculateTimeScore(timestamp: string): number {
  const messageDate = new Date(timestamp);
  const now = new Date();
  const hoursDiff = Math.abs(now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
  return Math.exp(-this.TIME_DECAY_FACTOR * hoursDiff);
}

private calculateChannelScore(messageChannelId: string, searchChannelId?: string): number {
  if (!searchChannelId) return 1;
  return messageChannelId === searchChannelId ? this.CHANNEL_BOOST_FACTOR : 1;
}
```

Potential scoring enhancements:
1. **Thread Relevance**: Messages in the same thread get a boost
2. **Conversation Flow**: Messages that are part of an active conversation get higher scores
3. **Context Completeness**: Score based on how much of the context chain we have

## Context Window Management

### Conceptual Overview

1. **What is a Context Window?**
- It's the set of relevant messages/content we provide to the AI model when generating responses
- Think of it like giving the AI "working memory" about the conversation
- Limited by token limits (usually 4000-8000 tokens)

2. **Why is it Critical?**
- Quality: Better context = better AI responses
- Example:
```
User: "How do I fix this?"
AI needs context: What is "this"? What was discussed before? Any error messages?
```

3. **Current Challenges:**
- Token Limits: Can't send everything to the AI
- Relevance: Must choose most important context
- Coherence: Need to maintain conversation flow
- Example:
```
Message 1: "I'm getting a 404 error"
Message 2: "Which endpoint?"
Message 3: "The /users/profile"
Message 4: "Check your authentication token"
Message 5: "Thanks, that fixed it!"
```
If we can only include 3 messages due to token limits, which are most important for understanding the solution?

4. **Why Management Matters:**
- Prevents context loss
- Maintains conversation coherence
- Optimizes token usage
- Improves response accuracy

5. **Impact on RAG:**
- Affects retrieval quality
- Influences AI's understanding
- Determines response relevance

### Practical Implementation in Our System

1. **Token Management:**
```typescript
private readonly DEFAULT_MAX_TOKENS = 4000;
private estimateTokens(text: string): number {
    // 4 chars = 1 token ratio
    return Math.ceil(text.length / 4);
}
```
This ensures we don't exceed AI model limits.

2. **Relevance Scoring:**
We use multiple factors:
```typescript
// In VectorStoreService
- Time relevance: calculateTimeScore() // Recent messages score higher
- Channel relevance: calculateChannelScore() // Same channel = 1.5x boost
- Thread relevance: calculateThreadScore() // Related messages = 1.3x boost
```

3. **Practical Example:**
```typescript
User: "What's the status of the API integration?"

Context Window Construction:
1. Find similar messages (vector search)
2. Score and rank:
   - Recent messages about API (high time + semantic score)
   - Messages in same channel (channel boost)
   - Related thread messages (thread boost)
3. Reconstruct context until token limit
```

4. **Current Implementation Features:**
- Multi-channel awareness
- Thread preservation
- Token budget management
- Parent-child message relationships
```typescript
interface ContextWindow {
  messages: ContextMessage[];
  totalTokens: number;
  channels: Set<string>;
}
```

5. **Real System Impact:**
```typescript
// Example context window construction
const result = await getContextWindow({
  channelId: 'engineering',
  prompt: "API status",
  maxTokens: 4000,
  includeRelatedChannels: true,
  minScore: 0.7
});
```
This might return:
- Recent API status updates
- Related error reports
- Resolution messages
- Cross-channel mentions 

## Context Window Management and Thread Relevance

### Changes Made
1. **Message Filtering Logic**
   - Initially filtered out messages below minimum score threshold (0.7)
   - Discovered this was too aggressive as it excluded relevant thread messages
   - Added `threadMessages` Set to track messages that should be included regardless of score
   - Modified filtering to keep messages that are either:
     - Above minimum score threshold OR
     - Part of a thread conversation (replies or parent messages)

2. **Score Boosting System**
   - Implemented a multi-factor scoring system:
     - `baseScore`: Original vector similarity score
     - `channelBoost`: 1.5x for messages in same channel
     - `threadBoost`: 1.3x for messages in same thread
     - Final score = baseScore * channelBoost * threadBoost

### Learning Lessons
1. **Context Preservation**
   - Thread context is crucial for maintaining conversation coherence
   - Even low-scoring messages can be important if they're part of a relevant thread
   - System preserves conversation threads while still prioritizing relevance

2. **Balanced Filtering**
   - Initial strict filtering (score < 0.7) was too aggressive
   - Solution balances between:
     - High relevance (vector similarity)
     - Conversation context (thread relationships)
     - Channel relevance (same channel boost)

3. **Token Management**
   - System maintains token budget while including context
   - Considers both message content and parent message tokens
   - Breaks early if token limit would be exceeded

4. **Testing Importance**
   - Tests helped catch the thread context issue
   - Test cases verify both basic functionality and edge cases
   - Importance of testing real-world scenarios (thread conversations)