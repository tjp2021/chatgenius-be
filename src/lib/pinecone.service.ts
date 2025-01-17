import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';

export interface QueryOptions {
  filter?: Record<string, any>;
}

export interface Vector {
  id: string;
  values: number[];
  metadata: any;
}

@Injectable()
export class PineconeService implements OnModuleInit {
  private pinecone: Pinecone;
  private readonly indexName: string;

  constructor(private configService: ConfigService) {
    this.pinecone = new Pinecone({ 
      apiKey: this.configService.get<string>('PINECONE_API_KEY')
    });
    this.indexName = this.configService.get<string>('PINECONE_INDEX_NAME');
  }

  async onModuleInit() {
    // Verify connection by listing indexes
    const indexes = await this.pinecone.listIndexes();
    console.log('Available indexes:', indexes);
    if (!indexes) {
      throw new Error(`No indexes found`);
    }
  }

  async upsertVector(id: string, values: number[], metadata: any) {
    const index = this.pinecone.Index(this.indexName);
    // @ts-ignore - SDK type issues
    await index.upsert([{
      id,
      values,
      metadata
    }]);
  }

  async upsertVectors(vectors: Vector[]) {
    if (vectors.length === 0) return;
    
    const index = this.pinecone.Index(this.indexName);
    // @ts-ignore - SDK type issues
    await index.upsert(vectors);
  }

  async queryVectors(values: number[], topK: number = 5, options: QueryOptions = {}) {
    const index = this.pinecone.Index(this.indexName);
    return await index.query({
      vector: values,
      topK,
      includeMetadata: true,
      filter: options.filter
    });
  }

  async getVectorById(id: string) {
    const index = this.pinecone.Index(this.indexName);
    // @ts-ignore - SDK type issues
    const results = await index.fetch([id]);
    return results[0];
  }

  async clearVectors() {
    const index = this.pinecone.Index(this.indexName);
    try {
      // @ts-ignore - SDK type issues
      await index.deleteAll();
      console.log('✅ Vector store cleared successfully!');
    } catch (error) {
      console.error('Failed to clear vectors:', error);
      throw error;
    }
  }
} 