import { Controller, Post, Body, Get, Put, Param, BadRequestException } from '@nestjs/common';
import { AvatarService } from '../../lib/avatar.service';
import { AvatarAnalysis } from '../../interfaces/avatar.interface';
import { VectorStoreService } from '../../lib/vector-store.service';

@Controller('avatars')
export class AvatarController {
  constructor(
    private readonly avatarService: AvatarService,
    private readonly vectorStore: VectorStoreService
  ) {}

  @Post()
  async createAvatar(
    @Body('userId') userId: string
  ): Promise<AvatarAnalysis> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.avatarService.createAvatar(userId);
  }

  @Post(':userId/generate')
  async generateResponse(
    @Param('userId') userId: string,
    @Body('prompt') prompt: string
  ): Promise<{ response: string }> {
    if (!userId || !prompt) {
      throw new BadRequestException('userId and prompt are required');
    }
    const response = await this.avatarService.generateResponse(userId, prompt);
    return { response };
  }

  @Put(':userId')
  async updateAvatar(
    @Param('userId') userId: string
  ): Promise<AvatarAnalysis> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.avatarService.updateAvatar(userId);
  }

  @Post('test/message')
  async testMessageStorage(
    @Body() data: {
      content: string;
      metadata: {
        userId: string;
        channelId: string;
      };
    }
  ) {
    if (!data.content || !data.metadata?.userId || !data.metadata?.channelId) {
      throw new BadRequestException('content, userId, and channelId are required');
    }

    // Store the message
    const messageId = `test-${Date.now()}`;
    await this.vectorStore.storeMessage(messageId, data.content, {
      ...data.metadata,
      timestamp: new Date().toISOString(),
    });

    // Retrieve similar messages
    const similar = await this.vectorStore.findSimilarMessages(data.content, {
      channelId: data.metadata.channelId,
      topK: 5,
    });

    return {
      stored: { messageId, ...data },
      similar,
    };
  }

  @Post('search')
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