import { Injectable } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { PineconeService } from './pinecone.service';

export interface SearchResult {
  messageId: string;
  content: string;
  score: number;
}

interface PineconeMetadata {
  content: string;
  [key: string]: unknown;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly pineconeService: PineconeService,
  ) {}

  async search(query: string): Promise<SearchResult[]> {
    // Generate embedding for the query
    const embedding = await this.openAIService.generateEmbedding(query);

    // Search Pinecone for similar vectors
    const searchResults = await this.pineconeService.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });

    // Transform results to our response format
    return searchResults.matches.map(match => ({
      messageId: match.id,
      content: (match.metadata as PineconeMetadata)?.content?.toString() || '',
      score: match.score,
    }));
  }
} 