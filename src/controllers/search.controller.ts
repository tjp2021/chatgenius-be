import { Controller, Post, Body, UseGuards, Req, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { MessagesService } from '../modules/messages/services/messages.service';
import { AiService } from '../lib/ai.service';
// import { ClerkAuthGuard } from '../guards/clerk-auth.guard';
import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}

@Controller('search')
// @UseGuards(ClerkAuthGuard)
export class SearchController {
  private readonly logger = new Logger('SearchController');

  constructor(
    private readonly messagesService: MessagesService,
    private readonly aiService: AiService,
  ) {}

  @Post()
  async search(@Body() searchRequest: SearchRequestDto) {
    const userId = 'user_001'; // Using live user ID
    this.logger.log(`Search request from user ${userId}: ${JSON.stringify(searchRequest)}`);

    try {
      // Extract command if present (e.g., /from, /thread, /summary)
      const commandMatch = searchRequest.query.match(/^\/(\w+)\s+(.+)$/);
      
      if (!commandMatch) {
        // Direct search query - use existing semantic search
        return this.messagesService.searchMessages(userId, searchRequest.query, {
          limit: searchRequest.limit,
          cursor: searchRequest.cursor,
          minScore: searchRequest.minScore,
          searchType: 'semantic'
        });
      }

      const [, command, query] = commandMatch;

      // Handle different command types
      switch (command.toLowerCase()) {
        case 'rag':
          // RAG-specific functionality
          return this.messagesService.searchMessages(userId, query, {
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            searchType: 'semantic'
          });

        case 'text':
          // Text-based search
          return this.messagesService.searchMessages(userId, query, {
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            searchType: 'text'
          });

        case 'from': {
          // Extract user ID and query
          const [targetUserId, ...queryParts] = query.split(' ');
          const searchQuery = queryParts.join(' ');
          
          if (!targetUserId || !searchQuery) {
            throw new BadRequestException('Both user ID and search query are required for /from command');
          }

          // Search messages from specific user
          return this.messagesService.searchMessages(userId, searchQuery, {
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            searchType: 'semantic',
            fromUserId: targetUserId
          });
        }

        case 'summary': {
          // Search for relevant messages first
          const messages = await this.messagesService.searchMessages(userId, query, {
            limit: 10,
            minScore: 0.7,
            searchType: 'semantic'
          });

          if (messages.items.length === 0) {
            return {
              summary: "No relevant messages found to summarize.",
              context: [],
              total: 0
            };
          }

          // Generate summary using AI
          const result = await this.aiService.synthesizeResponse(
            messages.items[0].channelId,
            `Generate a concise summary of these messages: ${messages.items.map(m => m.content).join('\n')}`
          );

          return {
            summary: result.response,
            context: messages.items,
            total: messages.total
          };
        }

        default:
          // Treat unknown commands as semantic search
          this.logger.warn(`Unknown command type: ${command}`);
          return this.messagesService.searchMessages(userId, query, {
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            searchType: 'semantic'
          });
      }
    } catch (error) {
      this.logger.error(`Error processing search request: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process search request');
    }
  }
} 