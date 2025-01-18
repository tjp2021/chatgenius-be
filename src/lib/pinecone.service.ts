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
    const index = this.pinecone.index(this.indexName);
    await index.upsert([{
      id,
      values,
      metadata
    }]);
  }

  async upsertVectors(vectors: Vector[]) {
    if (vectors.length === 0) return;
    
    const index = this.pinecone.index(this.indexName);
    await index.upsert(vectors.map(v => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata
    })));
  }

  async queryVectors(values: number[], topK: number = 5, options: QueryOptions = {}) {
    const index = this.pinecone.index(this.indexName);
    return await index.query({
      vector: values,
      topK,
      includeMetadata: true,
      filter: options.filter || undefined
    });
  }

  async getVectorById(id: string) {
    const index = this.pinecone.index(this.indexName);
    const results = await index.fetch([id]);
    return results.records[id];
  }

  async clearVectors() {
    const index = this.pinecone.index(this.indexName);
    try {
      await index.deleteAll();
      console.log('✅ Vector store cleared successfully!');
    } catch (error) {
      console.error('Failed to clear vectors:', error);
      throw error;
    }
  }
} 