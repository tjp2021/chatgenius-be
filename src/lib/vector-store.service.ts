import { Injectable } from '@nestjs/common';
import { PineconeService, Vector, QueryOptions } from './pinecone.service';
import { EmbeddingService } from './embedding.service';

interface Message {
  id: string;
  content: string;
  metadata: MessageMetadata;
}

interface MessageMetadata {
  channelId: string;
  userId: string;
  timestamp: string;
  replyTo?: string;
  [key: string]: any;
}

interface SearchOptions {
  channelId?: string;
  channelIds?: string[];
  topK?: number;
  minScore?: number;
}

@Injectable()
export class VectorStoreService {
  // Decay factor for time-based scoring (can be adjusted)
  private readonly TIME_DECAY_FACTOR = 0.1;
  // Channel relevance boost factor
  private readonly CHANNEL_BOOST_FACTOR = 1.5;
  // Default minimum score threshold
  private readonly DEFAULT_MIN_SCORE = 0.7;

  constructor(
    private pinecone: PineconeService,
    private embedding: EmbeddingService
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

  async storeMessage(id: string, content: string, metadata: MessageMetadata) {
    if (!metadata.channelId) {
      throw new Error('channelId is required in metadata');
    }

    // 1. Create embedding
    const vector = await this.embedding.createEmbedding(content);
    
    // 2. Store in Pinecone with required metadata
    await this.pinecone.upsertVector(id, vector, {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString()
    });
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
    
    // 3. Search in Pinecone with channel filter
    const results = await this.pinecone.queryVectors(vector, topK, { filter });
    
    // 4. Transform results and include context
    const messages = results.matches?.map(match => {
      const timeScore = this.calculateTimeScore(match.metadata.timestamp.toString());
      const channelScore = this.calculateChannelScore(
        match.metadata.channelId.toString(),
        channelId
      );
      const combinedScore = match.score * timeScore * channelScore;
      
      return {
        id: match.id,
        score: combinedScore,
        metadata: match.metadata,
        originalScore: match.score,
        timeScore,
        channelScore
      };
    }).filter(msg => msg.score >= minScore) || [];

    // 5. For messages with replyTo, include the context
    const messagesWithContext = await Promise.all(
      messages.map(async (msg) => {
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

    // 6. Sort by combined score
    return messagesWithContext.sort((a, b) => b.score - a.score);
  }
} 