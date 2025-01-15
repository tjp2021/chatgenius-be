import { Injectable } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { PineconeService } from './pinecone.service';

export interface SearchResult {
  messageId: string;
  content: string;
  score: number;
  // Extensible metadata for future avatar features
  metadata?: {
    userId?: string;
    timestamp?: string;
    context?: {
      threadId?: string;
      isReply?: boolean;
      channel?: string;
    }
  }
}

interface PineconeMetadata {
  content: string;
  userId?: string;
  timestamp?: string;
  threadId?: string;
  isReply?: boolean;
  channel?: string;
  [key: string]: unknown;
}

@Injectable()
export class SearchService {
  // Minimum confidence score for results
  private readonly MIN_SCORE = 0.8;

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly pineconeService: PineconeService,
  ) {}

  async search(query: string, options?: { userId?: string }): Promise<SearchResult[]> {
    // Generate embedding for the query
    const embedding = await this.openAIService.generateEmbedding(query);

    // Search Pinecone for similar vectors
    const searchResults = await this.pineconeService.query({
      vector: embedding,
      topK: 3,  // Keep top 3 for quality
      includeMetadata: true,
      filter: options?.userId ? { userId: options.userId } : undefined
    });

    // Transform and filter results
    return searchResults.matches
      .filter(match => match.score >= this.MIN_SCORE)
      .map(match => ({
        messageId: match.id,
        content: (match.metadata as PineconeMetadata)?.content?.toString() || '',
        score: match.score,
        metadata: {
          userId: (match.metadata as PineconeMetadata)?.userId,
          timestamp: (match.metadata as PineconeMetadata)?.timestamp,
          context: {
            threadId: (match.metadata as PineconeMetadata)?.threadId,
            isReply: (match.metadata as PineconeMetadata)?.isReply,
            channel: (match.metadata as PineconeMetadata)?.channel
          }
        }
      }));
  }
} 