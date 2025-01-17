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

export interface SearchOptions {
  userId?: string;
  limit?: number;
  minScore?: number;
  searchType?: 'semantic' | 'text';
  cursor?: string;
  fromUserId?: string;
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
    
    const { userId, limit = 10, minScore = 0.5, searchType = 'semantic', fromUserId } = options;
    
    return this.messagesService.searchMessages(userId || 'test-user-123', query, {
      limit,
      minScore,
      searchType,
      fromUserId
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

  async getThreadMessages(messageId: string, userId: string): Promise<{ messages: any[] }> {
    this.logger.log(`Getting thread messages for messageId: ${messageId}`);
    return this.messagesService.getThreadMessages(messageId, userId);
  }

  async generateSummary(userId: string, query: string): Promise<{ summary: string; context: any[] }> {
    this.logger.log(`Generating summary for query: ${query}`);
    
    // Get relevant messages
    const searchResults = await this.messagesService.searchMessages(userId, query, {
      limit: 10,
      minScore: 0.6,
      searchType: 'semantic'
    });

    if (searchResults.items.length === 0) {
      return {
        summary: "No relevant messages found to summarize.",
        context: []
      };
    }

    // Format messages for context
    const contextMessages = this.formatContextMessages(searchResults.items);

    // Generate summary using context
    const response = await this.synthesis.synthesizeResponse({
      channelId: 'summary-response',
      prompt: `Generate a concise summary of these messages:\n\n${contextMessages}`,
    });

    return {
      summary: response.response,
      context: searchResults.items
    };
  }
} 