import { Controller, Post, Body, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SearchService } from '../services/search.service';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
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
export class SearchController {
  private readonly logger = new Logger('SearchController');

  constructor(
    private readonly searchService: SearchService,
  ) {}

  @Post()
  async search(@Body() searchRequest: SearchRequestDto) {
    const userId = 'user_001'; // Using live user ID
    this.logger.log(`Search request from user ${userId}: ${JSON.stringify(searchRequest)}`);

    try {
      // Extract command if present (e.g., /from, /thread, /summary)
      const commandMatch = searchRequest.query.match(/^\/(\w+)\s+(.+)$/);
      
      if (!commandMatch) {
        // Direct search query
        return this.searchService.search(searchRequest.query, {
          userId,
          limit: searchRequest.limit,
          cursor: searchRequest.cursor,
          minScore: searchRequest.minScore
        });
      }

      const [, command, query] = commandMatch;

      // Handle different command types
      switch (command.toLowerCase()) {
        case 'rag': {
          const response = await this.searchService.generateRagResponse(userId, query);
          return {
            response,
            type: 'rag'
          };
        }

        case 'text':
          return this.searchService.search(query, {
            userId,
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

          return this.searchService.search(searchQuery, {
            userId,
            limit: searchRequest.limit,
            cursor: searchRequest.cursor,
            minScore: searchRequest.minScore,
            searchType: 'semantic'
          });
        }

        default:
          // Treat unknown commands as semantic search
          this.logger.warn(`Unknown command type: ${command}`);
          return this.searchService.search(query, {
            userId,
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