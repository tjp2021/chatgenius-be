import { Injectable } from '@nestjs/common';
import { PineconeService, Vector } from './pinecone.service';
import { EmbeddingService } from './embedding.service';

interface Message {
  id: string;
  content: string;
  metadata: any;
}

@Injectable()
export class VectorStoreService {
  // Decay factor for time-based scoring (can be adjusted)
  private readonly TIME_DECAY_FACTOR = 0.1;

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

  async storeMessage(id: string, content: string, metadata: any) {
    // 1. Create embedding
    const vector = await this.embedding.createEmbedding(content);
    
    // 2. Store in Pinecone
    await this.pinecone.upsertVector(id, vector, {
      ...metadata,
      timestamp: (metadata.timestamp || new Date().toISOString()).toString() // Ensure timestamp is string
    });
  }

  async storeMessages(messages: Message[]) {
    if (messages.length === 0) return;

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
        timestamp: (msg.metadata.timestamp || new Date().toISOString()).toString()
      }
    }));

    // 3. Store batch in Pinecone
    await this.pinecone.upsertVectors(vectors);
  }

  async findSimilarMessages(content: string, topK: number = 5) {
    // 1. Create embedding for search query
    const vector = await this.embedding.createEmbedding(content);
    
    // 2. Search in Pinecone
    const results = await this.pinecone.queryVectors(vector, topK);
    
    // 3. Transform results and include context
    const messages = results.matches?.map(match => {
      const timeScore = match.metadata?.timestamp ? 
        this.calculateTimeScore(match.metadata.timestamp.toString()) : 1;
      
      return {
        id: match.id,
        score: match.score * timeScore, // Combine semantic and time scores
        metadata: match.metadata,
        originalScore: match.score, // Keep original score for reference
        timeScore
      };
    }) || [];

    // 4. For messages with replyTo, include the context
    const messagesWithContext = await Promise.all(
      messages.map(async (msg) => {
        const replyToId = msg.metadata?.replyTo;
        if (replyToId && typeof replyToId === 'string') {
          // Find the parent message directly by ID
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

    // 5. Sort by combined score
    return messagesWithContext.sort((a, b) => b.score - a.score);
  }
} 