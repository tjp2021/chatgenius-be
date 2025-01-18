import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SearchService } from '../services/search.service';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';
import { SearchResponse, RAGResponse } from '../types';

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

@Controller('search')
@UseGuards(ClerkAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('semantic')
  async semanticSearch(
    @Body() body: SearchRequest,
    @Req() req: any
  ): Promise<SearchResponse> {
    const response = await this.searchService.semanticSearch({
      ...body,
      userId: req.auth.userId
    });
    console.log('Controller response:', JSON.stringify(response, null, 2));
    return response;
  }

  @Post('channel/:channelId')
  async channelSearch(
    @Param('channelId') channelId: string,
    @Body() body: Omit<SearchRequest, 'channelId'>,
    @Req() req: any
  ): Promise<SearchResponse> {
    return this.searchService.channelSearch(channelId, {
      ...body,
      userId: req.auth.userId
    });
  }

  @Post('user/:userId')
  async userSearch(
    @Param('userId') userId: string,
    @Body() body: SearchRequest,
    @Req() req: any
  ): Promise<SearchResponse> {
    return this.searchService.userSearch(userId, {
      ...body,
      userId: req.auth.userId
    });
  }

  @Post('rag')
  async ragSearch(
    @Body() body: RAGRequest,
    @Req() req: any
  ): Promise<RAGResponse> {
    return this.searchService.ragSearch({
      ...body,
      userId: req.auth.userId
    });
  }
} 