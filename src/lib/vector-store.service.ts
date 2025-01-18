import { Injectable } from '@nestjs/common';
import { PineconeService, Vector } from './pinecone.service';
import { EmbeddingService } from './embedding.service';
import { TextChunkingService, TextChunk } from './text-chunking.service';
import { ScoredPineconeRecord } from '@pinecone-database/pinecone';

export interface Message {
  id: string;
  content: string;
  metadata: MessageMetadata;
}

export interface MessageMetadata {
  channelId: string;
  userId: string;
  timestamp: string;
  replyTo?: string;
  [key: string]: any;
}

export interface MessageBatch {
  id: string;
  content: string;
  metadata: MessageMetadata;
}

interface ChunkMetadata extends MessageMetadata {
  chunkIndex: number;
  totalChunks: number;
  messageId: string;  // Reference to the original message
}

interface SearchOptions {
  channelId?: string;
  channelIds?: string[];
  topK?: number;
  minScore?: number;
  cursor?: string;
  dateRange?: { start: string; end: string; };
  threadOptions?: {
    include: boolean;
    expand: boolean;
    maxReplies?: number;
    scoreThreshold?: number;
  };
  filters?: {
    messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>;
    hasAttachments?: boolean;
    hasReactions?: boolean;
    fromUsers?: string[];
    excludeUsers?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
  page?: number;
  pageSize?: number;
}

interface PineconeQueryOptions {
  filter?: any;
  cursor?: string;
  dateRange?: { start: string; end: string; };
}

interface BatchResult {
  messageId: string;
  success: boolean;
  error?: string;
}

interface PineconeChunkMetadata extends ChunkMetadata {
  content: string;
  chunkIndex: number;
}

export interface SearchResult {
  messages: Array<{
    id: string;
    content: string;
    score: number;
    metadata: MessageMetadata & {
      userName?: string;
      scores?: {
        semantic: number;
        time: number;
        channel: number;
        thread?: number;
        final: number;
      };
    };
  }>;
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  threadMatches?: number;
  metadata?: {
    searchTime: number;
    scoreFactors: {
      semantic: string;
      time: string;
      channel: string;
      thread: string;
    };
  };
}

interface UserMetadata {
  id: string;
  name?: string;
  role?: string;
}

interface ExtendedMetadata extends MessageMetadata {
  user?: UserMetadata;
  userName?: string;
}

@Injectable()
export class VectorStoreService {
  // Decay factor for time-based scoring (can be adjusted)
  private readonly TIME_DECAY_FACTOR = 0.1;
  // Channel relevance boost factor
  private readonly CHANNEL_BOOST_FACTOR = 1.2;
  // Add thread boost factor
  private readonly THREAD_BOOST_FACTOR = 1.5;
  // Default minimum score threshold
  private readonly DEFAULT_MIN_SCORE = 0.6;
  private readonly MIN_CONTENT_LENGTH = 10; // Minimum content length to be considered valid
  private readonly DUPLICATE_TIME_WINDOW = 60 * 1000; // 60 seconds in milliseconds
  private readonly CONTENT_SIMILARITY_THRESHOLD = 0.9; // 90% similar content is considered duplicate

  // Scoring weights
  private readonly WEIGHTS = {
    semantic: 0.6,    // Semantic relevance is most important
    time: 0.2,       // Time decay has moderate importance
    channel: 0.1,    // Channel matching has lower importance
    thread: 0.1      // Thread context has lower importance
  };

  constructor(
    private pinecone: PineconeService,
    private embedding: EmbeddingService,
    private textChunking: TextChunkingService
  ) {}

  private calculateTimeScore(timestamp: string): number {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const hoursDiff = Math.abs(now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
    return Math.exp(-this.TIME_DECAY_FACTOR * hoursDiff); // Exponential decay
  }

  private calculateChannelScore(messageChannelId: string, searchChannelId?: string): number {
    // If no specific channel is requested, don't modify score
    if (!searchChannelId) return 1;
    // Boost score for messages from the same channel
    return messageChannelId === searchChannelId ? this.CHANNEL_BOOST_FACTOR : 1;
  }

  private calculateThreadScore(messageId: string, threadMessages: string[]): number {
    return threadMessages.includes(messageId) ? this.THREAD_BOOST_FACTOR : 1;
  }

  private cleanMetadata(metadata: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  private async storeChunk(chunk: TextChunk): Promise<void> {
    const vector = await this.embedding.createEmbedding(chunk.content);
    await this.pinecone.upsertVector(
      `${chunk.metadata.messageId}_chunk_${chunk.metadata.chunkIndex}`,
      vector,
      {
        ...chunk.metadata,
        content: chunk.content
      }
    );
  }

  private async storeChunkBatch(chunks: TextChunk[]): Promise<void> {
    console.log(`Creating embeddings for ${chunks.length} chunks...`);
    // Create embeddings in parallel
    const embeddings = await Promise.all(
      chunks.map(chunk => this.embedding.createEmbedding(chunk.content))
    );
    console.log('Embeddings created successfully');

    // Prepare vectors with metadata
    const vectors: Vector[] = chunks.map((chunk, i) => ({
      id: `${chunk.metadata.messageId}_chunk_${chunk.metadata.chunkIndex}`,
      values: embeddings[i],
      metadata: this.cleanMetadata({
        ...chunk.metadata,
        content: chunk.content
      })
    }));
    console.log('Vectors prepared:', vectors.length);

    // Store batch in Pinecone
    console.log('Storing vectors in Pinecone...');
    await this.pinecone.upsertVectors(vectors);
    console.log('Vectors stored successfully');
  }

  async storeMessageBatch(messages: MessageBatch[]): Promise<BatchResult[]> {
    if (messages.length === 0) return [];

    console.log(`Processing batch of ${messages.length} messages...`);

    // Validate all messages have channelId
    const invalidMessages = messages.filter(msg => !msg.metadata.channelId);
    if (invalidMessages.length > 0) {
      throw new Error('All messages must have channelId in metadata');
    }

    const results: BatchResult[] = [];
    const batchSize = 100; // Process chunks in batches of 100 for efficiency
    
    try {
      // 1. Create chunks for all messages in parallel
      console.log('Creating chunks for messages...');
      const messageChunks = await Promise.all(
        messages.map(async (msg) => ({
          messageId: msg.id,
          chunks: this.textChunking.chunkText(msg.content, {
            messageId: msg.id,
            content: msg.content,
            ...msg.metadata
          })
        }))
      );
      console.log('Chunks created successfully');

      // 2. Process chunks in batches
      const allChunks = messageChunks.flatMap(mc => mc.chunks);
      console.log(`Total chunks to process: ${allChunks.length}`);
      
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const chunkBatch = allChunks.slice(i, i + batchSize);
        console.log(`Processing chunk batch ${i + 1} to ${i + chunkBatch.length}...`);
        await this.storeChunkBatch(chunkBatch);
      }

      // 3. Record successful results
      results.push(...messages.map(msg => ({
        messageId: msg.id,
        success: true
      })));

    } catch (error) {
      console.error('Error in storeMessageBatch:', error);
      // If batch operation fails, mark all as failed
      results.push(...messages.map(msg => ({
        messageId: msg.id,
        success: false,
        error: error.message
      })));
    }

    return results;
  }

  async storeMessage(id: string, content: string, metadata: MessageMetadata) {
    const results = await this.storeMessageBatch([{ id, content, metadata }]);
    const result = results[0];
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to store message');
    }
  }

  async storeMessages(messages: Message[]) {
    if (messages.length === 0) return;

    // Validate all messages have channelId
    if (messages.some(msg => !msg.metadata.channelId)) {
      throw new Error('All messages must have channelId in metadata');
    }

    // 1. Create embeddings in parallel
    const embeddings = await Promise.all(
      messages.map(msg => this.embedding.createEmbedding(msg.content))
    );

    // 2. Prepare vectors with metadata
    const vectors: Vector[] = messages.map((msg, i) => ({
      id: msg.id,
      values: embeddings[i],
      metadata: {
        ...msg.metadata,
        timestamp: msg.metadata.timestamp || new Date().toISOString()
      }
    }));

    // 3. Store batch in Pinecone
    await this.pinecone.upsertVectors(vectors);
  }

  private isValidContent(content: string): boolean {
    return content.trim().length >= this.MIN_CONTENT_LENGTH;
  }

  private isDuplicate(message: { content: string, metadata: { timestamp: string } }, 
                     existingMessages: Array<{ content: string, metadata: { timestamp: string } }>): boolean {
    const messageTime = new Date(message.metadata.timestamp).getTime();
    
    return existingMessages.some(existing => {
      // Check time proximity
      const existingTime = new Date(existing.metadata.timestamp).getTime();
      const timeProximity = Math.abs(messageTime - existingTime);
      
      if (timeProximity > this.DUPLICATE_TIME_WINDOW) {
        return false;
      }

      // Check content similarity (simple for now)
      const normalizedContent = message.content.toLowerCase().trim();
      const normalizedExisting = existing.content.toLowerCase().trim();
      
      // If contents are very similar and within time window, consider it a duplicate
      return normalizedContent === normalizedExisting;
    });
  }

  async findSimilarMessages(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();
    const queryEmbedding = await this.embedding.createEmbedding(query);
    const minScore = options.minScore || this.DEFAULT_MIN_SCORE;
    const limit = options.topK || 10;

    // Initialize filter with a default condition to satisfy Pinecone's requirement
    const pineconeOptions: PineconeQueryOptions = {
      filter: undefined,
      cursor: options.cursor
    };

    // Add user filter if specified
    if (options.filters?.fromUsers?.length === 1) {
      pineconeOptions.filter = { userId: options.filters.fromUsers[0] };
    }

    // Add channel filter if specified
    if (options.channelId) {
      pineconeOptions.filter = {
        ...pineconeOptions.filter,
        channelId: options.channelId
      };
    }

    // Add date range filter if specified
    if (options.dateRange) {
      pineconeOptions.filter = {
        ...pineconeOptions.filter,
        timestamp: {
          $gte: options.dateRange.start,
          $lte: options.dateRange.end
        }
      };
    }

    const results = await this.pinecone.queryVectors(queryEmbedding, limit * 2, pineconeOptions);
    
    // Filter and process results with duplicate detection
    const processedMessages: Array<{
      id: string,
      content: string,
      score: number,
      metadata: MessageMetadata & { 
        userName?: string,
        scores?: {
          semantic: number,
          time: number,
          channel: number,
          thread?: number,
          final: number
        }
      }
    }> = [];

    // Set minimum semantic score threshold
    const MIN_SEMANTIC_SCORE = 0.7;

    // Get pagination parameters
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;

    // Get the target user ID if specified
    const targetUserId = options.filters?.fromUsers?.[0];
    console.log('Target User ID:', targetUserId);
    console.log('Options:', JSON.stringify(options));

    for (const match of results.matches) {
      console.log('Processing match:', {
        userId: match.metadata.userId,
        score: match.score
      });

      // Skip if not from target user when user filter is specified
      if (targetUserId && match.metadata.userId !== targetUserId) {
        console.log('Skipping - user mismatch');
        continue;
      }

      const content = match.metadata.content as string;
      if (!this.isValidContent(content)) {
        console.log('Skipping - invalid content');
        continue;
      }

      // Calculate component scores
      const semanticScore = match.score;
      console.log('Semantic score:', semanticScore);
      
      // Skip if semantic score is too low
      if (semanticScore < MIN_SEMANTIC_SCORE) {
        console.log('Skipping - low semantic score');
        continue;
      }

      const timeScore = this.calculateTimeScore(match.metadata.timestamp as string);
      const channelScore = this.calculateChannelScore(
        match.metadata.channelId as string, 
        options.channelId
      );
      const threadScore = match.metadata.replyTo ? 
        this.calculateThreadScore(match.metadata.messageId as string, [match.metadata.replyTo as string]) : 1;

      // Calculate weighted average score
      const finalScore = (
        semanticScore * 0.8 +
        timeScore * 0.1 +
        channelScore * 0.05 +
        threadScore * 0.05
      );

      // Skip if final score is below minimum
      if (finalScore < minScore) continue;

      processedMessages.push({
        id: match.metadata.messageId as string,
        content,
        score: finalScore,
        metadata: {
          channelId: match.metadata.channelId as string,
          userId: match.metadata.userId as string,
          timestamp: match.metadata.timestamp as string,
          severity: match.metadata.severity as string,
          scores: {
            semantic: semanticScore,
            time: timeScore,
            channel: channelScore,
            thread: threadScore,
            final: finalScore
          }
        }
      });
    }

    console.log('Processed messages:', processedMessages.length);

    // Sort by score and apply pagination
    processedMessages.sort((a, b) => b.score - a.score);
    const paginatedMessages = processedMessages.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    return {
      messages: paginatedMessages,
      total: processedMessages.length,
      hasMore: results.matches.length > processedMessages.length,
      nextCursor: results.matches.length > processedMessages.length ? results.matches[limit].id : undefined,
      metadata: {
        searchTime: Date.now() - startTime,
        scoreFactors: {
          semantic: 'Base relevance to query (80% weight)',
          time: `Time decay (10% weight, factor: ${this.TIME_DECAY_FACTOR})`,
          channel: `Channel boost (5% weight): ${this.CHANNEL_BOOST_FACTOR}x`,
          thread: `Thread boost (5% weight): ${this.THREAD_BOOST_FACTOR}x`
        }
      }
    };
  }

  async clearVectors() {
    await this.pinecone.clearVectors();
  }

  private async findThreadReplies(threadId: string, options: {
    maxReplies?: number;
    scoreThreshold?: number;
  } = {}): Promise<Array<{
    id: string;
    content: string;
    score: number;
    metadata: MessageMetadata & {
      userName?: string;
    };
  }>> {
    const { maxReplies = 3, scoreThreshold = 0.5 } = options;

    // Get all replies to this thread
    const replies = await this.pinecone.queryVectors(null, maxReplies, {
      filter: {
        replyTo: { $eq: threadId }
      }
    } as PineconeQueryOptions);

    return (replies.matches || [])
      .filter(match => match.score >= scoreThreshold)
      .map(match => ({
        id: match.id,
        content: String(match.metadata.content),
        score: match.score,
        metadata: {
          ...match.metadata as MessageMetadata,
          userName: String(match.metadata.userName || '')
        }
      }));
  }
} 