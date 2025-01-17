import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../../messages/services/messages.service';
import { ResponseSynthesisService } from '../../../lib/response-synthesis.service';

interface SearchResult {
  items: any[];
  pageInfo: {
    hasNextPage: boolean;
  };
  total: number;
}

interface SearchOptions {
  userId?: string;
  limit?: number;
  minScore?: number;
  searchType?: 'semantic' | 'text';
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly synthesis: ResponseSynthesisService,
  ) {}

  private formatContextMessages(messages: any[]): string {
    if (!messages.length) return '';

    return messages
      .map(msg => `[${msg.createdAt.toISOString()}] ${msg.content}`)
      .join('\n');
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    this.logger.log(`Searching for query: ${query} with options:`, options);
    
    const { userId, limit = 10, minScore = 0.5, searchType = 'semantic' } = options;
    
    return this.messagesService.searchMessages(userId || 'test-user-123', query, {
      limit,
      minScore,
      searchType
    });
  }

  async generateRagResponse(userId: string, query: string): Promise<string> {
    this.logger.log(`Generating RAG response for query: ${query}`);
    
    // Get relevant messages
    const searchResults = await this.messagesService.searchMessages(userId, query, {
      limit: 5,
      minScore: 0.7,
      searchType: 'semantic'
    });

    // Format messages for context
    const contextMessages = this.formatContextMessages(searchResults.items);

    // Generate response using context
    const response = await this.synthesis.synthesizeResponse({
      channelId: 'rag-response', // Virtual channel for RAG responses
      prompt: contextMessages ? 
        `Based on the following context, answer this question:\n\nContext:\n${contextMessages}\n\nQuestion: ${query}` :
        `Answer this question without context: ${query}`,
    });

    return response.response;
  }
} 