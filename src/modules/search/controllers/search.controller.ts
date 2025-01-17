import { Controller, Post, Body, Logger, BadRequestException, InternalServerErrorException, UseGuards, Req } from '@nestjs/common';
import { SearchService } from '../services/search.service';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';

export interface SearchResponse {
  items?: any[];
  pageInfo?: {
    hasNextPage: boolean;
  };
  total?: number;
  response?: string;
  type?: 'rag';
}

export class SearchRequestDto {
  @ApiProperty({
    description: 'The search query. Can be a direct query or a command (e.g., /from user_id query)',
    example: 'How do I reset my password?',
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: 'Maximum number of results to return',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Pagination cursor',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    description: 'Minimum relevance score (0-1)',
    example: 0.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minScore?: number;

  @ApiProperty({
    description: 'User ID performing the search',
    example: 'test_user_1',
    required: true,
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Channel ID',
    example: 'test_channel_1',
    required: false,
  })
  @IsOptional()
  @IsString()
  channelId?: string;
}

@Controller('search')
@UseGuards(ClerkAuthGuard)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
  ) {}

  @Post()
  async search(@Body() searchRequest: SearchRequestDto, @Req() req: any): Promise<SearchResponse> {
    try {
      console.log('🔍 [SearchController] Received request:', {
        query: searchRequest.query,
        channelId: searchRequest.channelId,
        userId: req.auth?.userId,
        authUserId: req.auth?.userId,
        rawBody: req.body
      });

      // Extract command if present (e.g., /from, /thread, /summary)
      const commandMatch = searchRequest.query.match(/^\/(\w+)\s+(.+)$/);
      
      if (!commandMatch) {
        console.log('🔍 [SearchController] No command found, performing semantic search with:', {
          query: searchRequest.query,
          userId: req.auth.userId,
          limit: searchRequest.limit,
          cursor: searchRequest.cursor,
          minScore: searchRequest.minScore,
          channelId: searchRequest.channelId,
          searchType: 'semantic'
        });

        return this.searchService.search(searchRequest.query, {
          userId: req.auth.userId,
          limit: searchRequest.limit,
          cursor: searchRequest.cursor,
          minScore: searchRequest.minScore,
          channelId: searchRequest.channelId,
          searchType: 'semantic'
        });
      }

      const [, command, query] = commandMatch;
      console.log('🔍 [SearchController] Command detected:', {
        command,
        query,
        channelId: searchRequest.channelId
      });

      switch (command.toLowerCase()) {
        case 'in':
          console.log('🔍 [SearchController] Performing channel search with:', {
            query,
            userId: req.auth.userId,
            channelId: searchRequest.channelId
          });
          
          const [targetChannelId, ...searchQueryParts] = query.split(' ');
          const channelSearchQuery = searchQueryParts.join(' ');
          
          if (!targetChannelId) {
            throw new BadRequestException('Channel ID is required for /in command');
          }

          return this.searchService.search(channelSearchQuery || '', {
            userId: req.auth.userId,
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            channelId: targetChannelId,
            searchType: 'semantic'
          });

        case 'text':
          console.log('🔍 [SearchController] Performing text search with:', {
            query: query.trim(),
            userId: req.auth.userId,
            limit: searchRequest.limit,
            minScore: searchRequest.minScore,
            channelId: searchRequest.channelId
          });

          const result = await this.searchService.search(query.trim(), {
            userId: req.auth.userId,
            limit: searchRequest.limit,
            minScore: searchRequest.minScore,
            channelId: searchRequest.channelId,
            searchType: 'text'
          });
          console.log('🔍 [SearchController] Text search results:', {
            total: result.total,
            hasItems: result.items?.length > 0
          });
          return result;

        case 'rag':
          console.log('🔍 [SearchController] Performing RAG search');
          const response = await this.searchService.generateRagResponse(req.auth.userId, query);
          return { response, type: 'rag' };

        case 'from':
          const [targetUserId, ...queryParts] = query.split(' ');
          const searchQuery = queryParts.join(' ');
          
          if (!targetUserId || !searchQuery) {
            throw new BadRequestException('Both user ID and search query are required for /from command');
          }

          console.log('🔍 [SearchController] Performing from-user search:', {
            targetUserId,
            searchQuery
          });

          return this.searchService.search(searchQuery, {
            userId: req.auth.userId,
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            fromUserId: targetUserId,
            channelId: searchRequest.channelId,
            searchType: 'semantic'
          });

        case 'thread':
          const messageId = query.trim();
          if (!messageId) {
            throw new BadRequestException('Message ID is required for /thread command');
          }

          console.log('🔍 [SearchController] Performing thread search:', {
            messageId,
            userId: req.auth.userId,
            channelId: searchRequest.channelId,
            query: searchRequest.query,
            rawQuery: query,
            searchOptions: {
              userId: req.auth.userId,
              limit: searchRequest.limit,
              cursor: searchRequest.cursor,
              minScore: searchRequest.minScore,
              channelId: searchRequest.channelId,
              threadId: messageId,
              searchType: 'thread'
            }
          });

          const threadResult = await this.searchService.search('', {
            userId: req.auth.userId,
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            channelId: searchRequest.channelId,
            threadId: messageId,
            searchType: 'thread'
          });

          console.log('🔍 [SearchController] Thread search result:', {
            messageId,
            hasItems: threadResult.items?.length > 0,
            total: threadResult.total,
            firstItem: threadResult.items?.[0]
          });

          return threadResult;

        default:
          console.log('⚠️ [SearchController] Unknown command:', command);
          return this.searchService.search(query, {
            userId: req.auth.userId,
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            channelId: searchRequest.channelId,
            searchType: 'semantic'
          });
      }
    } catch (error) {
      console.error('❌ [SearchController] Error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process search request');
    }
  }
} 