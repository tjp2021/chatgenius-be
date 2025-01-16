import { Injectable } from '@nestjs/common';
import { PineconeService } from './pinecone.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class VectorStoreService {
  constructor(
    private pinecone: PineconeService,
    private embedding: EmbeddingService
  ) {}

  async storeMessage(id: string, content: string, metadata: any) {
    // 1. Create embedding
    const vector = await this.embedding.createEmbedding(content);
    
    // 2. Store in Pinecone
    await this.pinecone.upsertVector(id, vector, metadata);
  }

  async findSimilarMessages(content: string, topK: number = 5) {
    // 1. Create embedding for search query
    const vector = await this.embedding.createEmbedding(content);
    
    // 2. Search in Pinecone
    const results = await this.pinecone.queryVectors(vector, topK);
    
    return results.matches?.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata
    })) || [];
  }
} 