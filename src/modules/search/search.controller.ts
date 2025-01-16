import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { VectorStoreService } from '../../lib/vector-store.service';

@Controller('search')
export class SearchController {
  constructor(
    private readonly vectorStore: VectorStoreService
  ) {}

  @Post()
  async searchMessages(
    @Body() data: {
      query: string;
      channelId?: string;
    }
  ) {
    if (!data.query) {
      throw new BadRequestException('query is required');
    }

    const results = await this.vectorStore.findSimilarMessages(data.query, {
      channelId: data.channelId,
      topK: 5,
    });

    return {
      results: results.map(result => ({
        id: result.id,
        content: result.content,
        score: result.score,
        metadata: result.metadata
      }))
    };
  }
} 