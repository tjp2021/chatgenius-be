import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';

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
    // Verify connection
    const indexes = await this.pinecone.listIndexes();
    if (!indexes.indexes?.some(index => index.name === this.indexName)) {
      throw new Error(`Index ${this.indexName} not found`);
    }
  }

  async upsertVector(id: string, values: number[], metadata: any) {
    const index = this.pinecone.Index(this.indexName);
    await index.upsert([{
      id,
      values,
      metadata
    }]);
  }

  async queryVectors(values: number[], topK: number = 5) {
    const index = this.pinecone.Index(this.indexName);
    return await index.query({
      vector: values,
      topK,
      includeMetadata: true
    });
  }
} 