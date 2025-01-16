import { Injectable, BadRequestException } from '@nestjs/common';
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY')
    });
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new BadRequestException('Text input cannot be empty');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.slice(0, 8000)  // OpenAI token limit protection
      });
      return response.data[0].embedding;
    } catch (error) {
      throw error;
    }
  }
} 