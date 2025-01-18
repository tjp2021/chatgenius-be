import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SearchService } from '../services/search.service';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';
import { MessageContent, SearchOptions, SearchResponse, RAGResponse } from '../types';

@Controller('search')
@UseGuards(ClerkAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('semantic')
  async semanticSearch(@Body() body: {
    query: string;
    limit?: number;
    minScore?: number;
    cursor?: string;
    dateRange?: { start: string; end: string; };
  }): Promise<SearchResponse> {
    return this.searchService.semanticSearch(body);
  }

  @Post('channel/:channelId')
  async channelSearch(
    @Param('channelId') channelId: string,
    @Body() body: {
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
    return this.searchService.channelSearch(channelId, body);
  }

  @Post('user/:userId')
  async userSearch(
    @Param('userId') userId: string,
    @Body() body: {
      query: string;
      limit?: number;
      channelId?: string;
      includeThreads?: boolean;
      cursor?: string;
      dateRange?: { start: string; end: string; };
      messageTypes?: Array<'message' | 'thread_reply' | 'file_share' | 'code_snippet'>;
    }
  ): Promise<SearchResponse> {
    return this.searchService.userSearch(userId, body);
  }

  @Post('rag')
  async ragSearch(@Body() body: {
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
    return this.searchService.ragSearch(body);
  }
} 