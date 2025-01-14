import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import { SearchService } from '../lib/search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'Search for similar messages based on a question' })
  @ApiResponse({ status: 200, description: 'Search results', type: SearchResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async search(@Body() searchRequest: SearchRequestDto): Promise<SearchResponseDto> {
    try {
      const results = await this.searchService.search(searchRequest.query);
      return { results };
    } catch (error) {
      throw new HttpException(
        'Failed to perform search: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 