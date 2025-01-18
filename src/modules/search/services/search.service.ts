import { Injectable, Logger } from '@nestjs/common';
import { VectorStoreService } from '../../../lib/vector-store.service';
import { ResponseSynthesisService } from '../../../lib/response-synthesis.service';
import { MessageContent, SearchOptions, SearchResponse, RAGResponse } from '../types';

type SearchRequest = {
  query: string;
  channelId?: string;
  channelIds?: string[];
  topK?: number;
  minScore?: number;
  cursor?: string;
  dateRange?: { start: string; end: string; };
  sortBy?: 'relevance' | 'date';
  threadOptions?: {
    include: boolean;
    expand: boolean;
    maxReplies?: number;
    scoreThreshold?: number;
  };
  filters?: {
    messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>;
    hasAttachments?: boolean;
    hasReactions?: boolean;
    fromUsers?: string[];
    excludeUsers?: string[];
  };
};

type RAGRequest = {
  query: string;
  contextLimit?: number;
  minContextScore?: number;
  channelId?: string;
  dateRange?: { start: string; end: string; };
  responseFormat?: {
    maxLength?: number;
    style?: 'concise' | 'detailed';
    includeQuotes?: boolean;
  };
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly vectorStore: VectorStoreService,
    private readonly responseSynthesis: ResponseSynthesisService
  ) {}

  private mapToMessageContent(msg: any): MessageContent {
    return {
      id: msg.id,
      content: msg.content,
      metadata: msg.metadata,
      score: msg.score,
      user: {
        id: msg.metadata.userId,
        name: msg.metadata.userName || msg.user?.name || 'Unknown',
        role: msg.user?.role || 'user'
      },
      thread: msg.metadata.threadInfo ? {
        threadId: msg.metadata.replyTo || msg.id,
        replyCount: msg.metadata.threadInfo.replyCount,
        participantCount: 1,
        lastActivity: msg.metadata.timestamp,
        latestReplies: msg.metadata.threadInfo.latestReplies?.map(reply => this.mapToMessageContent(reply)) || []
      } : undefined
    };
  }

  async semanticSearch(options: SearchRequest & { userId: string }): Promise<SearchResponse> {
    try {
      const startTime = Date.now();
      const results = await this.vectorStore.findSimilarMessages(options.query, {
        topK: options.topK,
        minScore: options.minScore,
        cursor: options.cursor,
        dateRange: options.dateRange,
        filters: options.filters
      });

      const items = results.messages.map(msg => this.mapToMessageContent(msg));

      const response = {
        items,
        metadata: {
          searchTime: Date.now() - startTime,
          totalMatches: results.total
        },
        pageInfo: {
          hasNextPage: results.hasMore,
          cursor: results.nextCursor,
          total: results.total
        }
      };

      console.log('Search response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async channelSearch(channelId: string, options: SearchRequest & { userId: string }): Promise<SearchResponse> {
    try {
      const startTime = Date.now();
      const results = await this.vectorStore.findSimilarMessages(options.query, {
        channelId,
        topK: options.topK,
        minScore: options.minScore,
        cursor: options.cursor,
        dateRange: options.dateRange,
        threadOptions: options.threadOptions,
        filters: options.filters
      });

      return {
        items: results.messages.map(msg => this.mapToMessageContent(msg)),
        metadata: {
          searchTime: Date.now() - startTime,
          totalMatches: results.total,
          threadMatches: results.threadMatches
        },
        pageInfo: {
          hasNextPage: results.hasMore,
          cursor: results.nextCursor,
          total: results.total
        }
      };
    } catch (error) {
      this.logger.error(`Channel search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async userSearch(userId: string, options: SearchRequest & { userId: string }): Promise<SearchResponse> {
    try {
      const startTime = Date.now();
      const results = await this.vectorStore.findSimilarMessages(options.query, {
        channelId: options.channelId,
        topK: options.topK,
        cursor: options.cursor,
        dateRange: options.dateRange,
        filters: {
          fromUsers: [userId],
          messageTypes: options.filters?.messageTypes
        },
        threadOptions: {
          include: options.threadOptions?.include ?? true,
          expand: false
        }
      });

      return {
        items: results.messages.map(msg => this.mapToMessageContent(msg)),
        metadata: {
          searchTime: Date.now() - startTime,
          totalMatches: results.total
        },
        pageInfo: {
          hasNextPage: results.hasMore,
          cursor: results.nextCursor,
          total: results.total
        }
      };
    } catch (error) {
      this.logger.error(`User search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async ragSearch(options: RAGRequest & { userId: string }): Promise<RAGResponse> {
    try {
      const startTime = Date.now();
      const minScore = options.minContextScore || 0.7;
      
      // 1. Get relevant messages
      const results = await this.vectorStore.findSimilarMessages(options.query, {
        channelId: options.channelId,
        topK: options.contextLimit || 5,
        minScore,
        dateRange: options.dateRange
      });

      // Filter out low quality matches and verify semantic relevance
      const relevantMessages = results.messages.filter(msg => {
        // Must meet minimum score threshold
        if (msg.score < minScore) return false;
        
        // Must have high semantic relevance
        if (msg.metadata.scores?.semantic < 0.8) return false;

        // Basic keyword check for extremely unrelated content
        const keywords = options.query.toLowerCase().split(' ');
        const content = msg.content.toLowerCase();
        const hasRelevantKeywords = keywords.some(word => 
          word.length > 3 && content.includes(word)
        );
        
        return hasRelevantKeywords;
      });

      const hasRelevantContext = relevantMessages.length > 0;

      // 2. Format context and prepare prompt
      const context = relevantMessages
        .map(msg => `${msg.metadata.userName || 'Unknown'}: ${msg.content}`)
        .join('\n\n');

      const prompt = hasRelevantContext ? 
        `Based on the following context, answer this question:
         Context: ${context}
         Question: ${options.query}` :
        `Note: No relevant messages were found in the chat history for this query.
         Please provide a general response to this question:
         Question: ${options.query}`;

      // 3. Generate response
      const response = await this.responseSynthesis.synthesizeResponse({
        channelId: options.channelId || 'rag-response',
        prompt
      });

      // 4. Prepare response with accurate context information
      return {
        response: hasRelevantContext ? 
          response.response :
          `Note: No relevant messages were found in the chat history. Here's a general response:\n\n${response.response}`,
        contextMessageCount: relevantMessages.length,
        metadata: {
          searchTime: Date.now() - startTime,
          contextQuality: hasRelevantContext ? 
            relevantMessages[0].metadata.scores?.semantic || 0 : 0
        }
      };
    } catch (error) {
      this.logger.error(`RAG search failed: ${error.message}`, error.stack);
      throw error;
    }
  }
} 