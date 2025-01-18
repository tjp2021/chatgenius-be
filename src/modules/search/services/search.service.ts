import { Injectable, Logger } from '@nestjs/common';
import { VectorStoreService } from '../../../lib/vector-store.service';
import { ResponseSynthesisService } from '../../../lib/response-synthesis.service';
import { MessageContent, SearchOptions, SearchResponse, RAGResponse } from '../types';

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

  async semanticSearch(params: {
    query: string;
    limit?: number;
    minScore?: number;
    cursor?: string;
    dateRange?: { start: string; end: string; };
  }): Promise<SearchResponse> {
    try {
      const startTime = Date.now();
      const results = await this.vectorStore.findSimilarMessages(params.query, {
        topK: params.limit,
        minScore: params.minScore,
        cursor: params.cursor,
        dateRange: params.dateRange
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
      this.logger.error(`Semantic search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async channelSearch(
    channelId: string,
    params: {
      query: string;
      limit?: number;
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
    }
  ): Promise<SearchResponse> {
    try {
      const startTime = Date.now();
      const results = await this.vectorStore.findSimilarMessages(params.query, {
        channelId,
        topK: params.limit,
        minScore: params.minScore,
        cursor: params.cursor,
        dateRange: params.dateRange,
        threadOptions: params.threadOptions,
        filters: params.filters
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

  async userSearch(
    userId: string,
    params: {
      query: string;
      limit?: number;
      channelId?: string;
      includeThreads?: boolean;
      cursor?: string;
      dateRange?: { start: string; end: string; };
      messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>;
    }
  ): Promise<SearchResponse> {
    try {
      const startTime = Date.now();
      const results = await this.vectorStore.findSimilarMessages(params.query, {
        channelId: params.channelId,
        topK: params.limit,
        cursor: params.cursor,
        dateRange: params.dateRange,
        filters: {
          fromUsers: [userId],
          messageTypes: params.messageTypes
        },
        threadOptions: {
          include: params.includeThreads ?? true,
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

  async ragSearch(params: {
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
  }): Promise<RAGResponse> {
    try {
      const startTime = Date.now();
      const minScore = params.minContextScore || 0.7;
      
      // 1. Get relevant messages
      const results = await this.vectorStore.findSimilarMessages(params.query, {
        channelId: params.channelId,
        topK: params.contextLimit || 5,
        minScore,
        dateRange: params.dateRange
      });

      // Filter out low quality matches and verify semantic relevance
      const relevantMessages = results.messages.filter(msg => {
        // Must meet minimum score threshold
        if (msg.score < minScore) return false;
        
        // Must have high semantic relevance
        if (msg.metadata.scores?.semantic < 0.8) return false;

        // Basic keyword check for extremely unrelated content
        const keywords = params.query.toLowerCase().split(' ');
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
         Question: ${params.query}` :
        `Note: No relevant messages were found in the chat history for this query.
         Please provide a general response to this question:
         Question: ${params.query}`;

      // 3. Generate response
      const response = await this.responseSynthesis.synthesizeResponse({
        channelId: params.channelId || 'rag-response',
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