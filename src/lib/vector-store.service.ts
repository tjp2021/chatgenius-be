import { Injectable } from '@nestjs/common';
import { PineconeService, Vector, QueryOptions } from './pinecone.service';
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

@Injectable()
export class VectorStoreService {
  // Decay factor for time-based scoring (can be adjusted)
  private readonly TIME_DECAY_FACTOR = 0.5;
  // Channel relevance boost factor
  private readonly CHANNEL_BOOST_FACTOR = 1.2;
  // Add thread boost factor
  private readonly THREAD_BOOST_FACTOR = 1.5;
  // Default minimum score threshold
  private readonly DEFAULT_MIN_SCORE = 0.6;

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

  private async storeChunk(chunk: TextChunk): Promise<void> {
    const vector = await this.embedding.createEmbedding(chunk.content);
    await this.pinecone.upsertVector(
      `${chunk.metadata.messageId}_chunk_${chunk.metadata.chunkIndex}`,
      vector,
      chunk.metadata
    );
  }

  private async storeChunkBatch(chunks: TextChunk[]): Promise<void> {
    // Create embeddings in parallel
    const embeddings = await Promise.all(
      chunks.map(chunk => this.embedding.createEmbedding(chunk.content))
    );

    // Prepare vectors with metadata
    const vectors: Vector[] = chunks.map((chunk, i) => ({
      id: `${chunk.metadata.messageId}_chunk_${chunk.metadata.chunkIndex}`,
      values: embeddings[i],
      metadata: chunk.metadata
    }));

    // Store batch in Pinecone
    await this.pinecone.upsertVectors(vectors);
  }

  async storeMessageBatch(messages: MessageBatch[]): Promise<BatchResult[]> {
    if (messages.length === 0) return [];

    // Validate all messages have channelId
    const invalidMessages = messages.filter(msg => !msg.metadata.channelId);
    if (invalidMessages.length > 0) {
      throw new Error('All messages must have channelId in metadata');
    }

    const results: BatchResult[] = [];
    const batchSize = 100; // Process chunks in batches of 100 for efficiency
    
    try {
      // 1. Create chunks for all messages in parallel
      const messageChunks = await Promise.all(
        messages.map(async (msg) => ({
          messageId: msg.id,
          chunks: this.textChunking.chunkText(msg.content, {
            messageId: msg.id,
            ...msg.metadata
          })
        }))
      );

      // 2. Process chunks in batches
      const allChunks = messageChunks.flatMap(mc => mc.chunks);
      
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const chunkBatch = allChunks.slice(i, i + batchSize);
        await this.storeChunkBatch(chunkBatch);
      }

      // 3. Record successful results
      results.push(...messages.map(msg => ({
        messageId: msg.id,
        success: true
      })));

    } catch (error) {
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

  async findSimilarMessages(content: string, options: SearchOptions = {}) {
    const { channelId, channelIds, topK = 5, minScore = this.DEFAULT_MIN_SCORE } = options;
    
    // 1. Create embedding for search query
    const vector = await this.embedding.createEmbedding(content);
    
    // 2. Prepare filter for channel-aware search
    const filter: QueryOptions['filter'] = channelId ? 
      { channelId: { $eq: channelId } } : 
      channelIds?.length ? 
        { channelId: { $in: channelIds } } : 
        undefined;
    
    // 3. Search in Pinecone with increased topK to account for chunks
    const chunkResults = await this.pinecone.queryVectors(vector, topK * 3, { filter }) as {
      matches?: ScoredPineconeRecord<PineconeChunkMetadata>[];
      namespace: string;
    };
    
    // 4. Group chunks by original message ID and calculate scores
    const messageMap = new Map<string, {
      chunks: ScoredPineconeRecord<PineconeChunkMetadata>[],
      maxScore: number,
      metadata: PineconeChunkMetadata
    }>();

    // Track thread messages for scoring
    const threadMessages = new Set<string>();
    chunkResults.matches?.forEach(match => {
      const metadata = match.metadata as PineconeChunkMetadata;
      const messageId = metadata.messageId?.toString() || match.id;
      if (metadata.replyTo) {
        threadMessages.add(metadata.replyTo);
        threadMessages.add(messageId);
      }
    });

    chunkResults.matches?.forEach(match => {
      const metadata = match.metadata as PineconeChunkMetadata;
      const messageId = metadata.messageId?.toString() || match.id;
      const existing = messageMap.get(messageId) || { 
        chunks: [], 
        maxScore: 0, 
        metadata: {
          ...metadata,
          messageId
        }
      };
      
      // Only add chunk if we don't already have one with same index
      const chunkIndex = metadata.chunkIndex;
      const hasChunkWithIndex = existing.chunks.some(
        c => (c.metadata as PineconeChunkMetadata).chunkIndex === chunkIndex
      );

      if (!hasChunkWithIndex) {
        existing.chunks.push(match);
      } else {
        // If we have a chunk with this index, keep the one with higher score
        const existingChunk = existing.chunks.find(
          c => (c.metadata as PineconeChunkMetadata).chunkIndex === chunkIndex
        );
        if (match.score > existingChunk.score) {
          existing.chunks = existing.chunks.filter(
            c => (c.metadata as PineconeChunkMetadata).chunkIndex !== chunkIndex
          );
          existing.chunks.push(match);
        }
      }

      existing.maxScore = Math.max(existing.maxScore, match.score);
      messageMap.set(messageId, existing);
    });

    // 5. Transform results and include context
    const messages = Array.from(messageMap.values())
      .filter(({ maxScore }) => maxScore >= minScore)
      .map(({ chunks, maxScore, metadata }) => {
        const timeScore = this.calculateTimeScore(metadata.timestamp.toString());
        const channelScore = this.calculateChannelScore(
          metadata.channelId.toString(),
          channelId
        );
        const messageId = metadata.messageId.toString();
        const threadScore = this.calculateThreadScore(messageId, Array.from(threadMessages));

        // Sort chunks by index before reconstruction
        const sortedChunks = chunks.sort(
          (a, b) => (a.metadata as PineconeChunkMetadata).chunkIndex - (b.metadata as PineconeChunkMetadata).chunkIndex
        );

        // Reconstruct full message content if chunks exist
        const reconstructedContent = chunks.length > 1 ? 
          this.textChunking.reconstructText(
            sortedChunks.map(chunk => ({
              content: (chunk.metadata as PineconeChunkMetadata).content,
              metadata: chunk.metadata as PineconeChunkMetadata
            }))
          ) : (chunks[0].metadata as PineconeChunkMetadata).content || '';
        
        return {
          id: metadata.messageId.toString(),
          content: reconstructedContent,
          score: maxScore,  // Store raw score for now
          metadata: {
            ...metadata,
            originalScore: maxScore,
            timeScore,
            channelScore,
            threadScore,
            replyTo: metadata.replyTo
          }
        };
      });

    // 6. Group messages by thread
    const threadGroups = new Map<string, typeof messages>();
    messages.forEach(msg => {
      const threadId = msg.metadata.replyTo || msg.id;  // Use replyTo as thread ID, or message ID if no reply
      const group = threadGroups.get(threadId) || [];
      group.push(msg);
      threadGroups.set(threadId, group);
    });

    // 7. Calculate thread scores and sort
    const sortedMessages = Array.from(threadGroups.values())
      .map(group => {
        // All messages in thread get thread boost
        const hasThreadBoost = group.length > 1;
        
        // Calculate scores for each message in thread
        return group.map(msg => {
          // Within threads, boost the importance of time even more
          const timeBoost = hasThreadBoost ? Math.pow(msg.metadata.timeScore, 3) : Math.pow(msg.metadata.timeScore, 2);
          
          const finalScore = msg.score * 
            timeBoost * 
            msg.metadata.channelScore * 
            (hasThreadBoost ? this.THREAD_BOOST_FACTOR : 1);
            
          return {
            ...msg,
            score: finalScore,
            metadata: {
              ...msg.metadata,
              threadScore: hasThreadBoost ? this.THREAD_BOOST_FACTOR : 1
            }
          };
        });
      })
      .flat()
      .sort((a, b) => {
        // First compare by score
        const scoreDiff = b.score - a.score;
        // If scores are very close (within 0.01), use timestamp as tiebreaker
        if (Math.abs(scoreDiff) < 0.01) {
          return new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime();
        }
        return scoreDiff;
      })
      .slice(0, topK);

    // 8. Include context for messages with replyTo
    return Promise.all(
      sortedMessages.map(async (msg) => {
        const replyToId = msg.metadata?.replyTo;
        if (replyToId && typeof replyToId === 'string') {
          const parentMessage = await this.pinecone.getVectorById(replyToId);
          
          if (parentMessage) {
            return {
              ...msg,
              context: {
                parentMessage: {
                  id: parentMessage.id,
                  metadata: parentMessage.metadata
                }
              }
            };
          }
        }
        return msg;
      })
    );
  }

  async clearVectors() {
    await this.pinecone.clearVectors();
  }
} 