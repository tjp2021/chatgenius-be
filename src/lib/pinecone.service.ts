import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';

interface QueryOptions {
  vector: number[];
  topK: number;
  includeMetadata: boolean;
  filter?: Record<string, any>;
}

@Injectable()
export class PineconeService {
  private pinecone: Pinecone;
  private readonly indexName: string;

  constructor(private configService: ConfigService) {
    this.pinecone = new Pinecone({
      apiKey: this.configService.get<string>('PINECONE_API_KEY'),
    });
    this.indexName = 'chatgenius-1536';
  }

  async query(options: QueryOptions) {
    const index = this.pinecone.index(this.indexName);
    return index.query({
      vector: options.vector,
      topK: options.topK,
      includeMetadata: options.includeMetadata,
      filter: options.filter
    });
  }

  async upsert(id: string, vector: number[], metadata: Record<string, any>) {
    const index = this.pinecone.index(this.indexName);
    await index.upsert([
      {
        id,
        values: vector,
        metadata,
      },
    ]);
  }
} 