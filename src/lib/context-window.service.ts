import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { VectorStoreService } from './vector-store.service';

interface ContextWindowOptions {
  channelId: string;
  prompt: string;
  maxTokens?: number;
}

interface ContextMessage {
  id: string;
  content: string;
  createdAt: Date;
  score: number;
}

interface ContextWindow {
  messages: ContextMessage[];
  totalTokens: number;
}

@Injectable()
export class ContextWindowService {
  private readonly logger = new Logger(ContextWindowService.name);
  private readonly DEFAULT_MAX_TOKENS = 4000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorStore: VectorStoreService
  ) {}

  private estimateTokens(text: string): number {
    // Simple estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  private async getMessageContent(messageId: string): Promise<{ content: string; createdAt: Date } | null> {
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: {
          content: true,
          createdAt: true
        }
      });
      return message;
    } catch (error) {
      this.logger.error(`Error fetching message ${messageId}: ${error.message}`);
      return null;
    }
  }

  async getContextWindow(options: ContextWindowOptions): Promise<ContextWindow> {
    const maxTokens = options.maxTokens || this.DEFAULT_MAX_TOKENS;
    
    // Initialize empty result
    const result: ContextWindow = {
      messages: [],
      totalTokens: 0
    };

    try {
      // Get relevant messages using vector similarity
      const vectorResults = await this.vectorStore.findSimilarMessages(options.prompt);
      
      // Add messages while respecting token limit
      for (const vectorResult of vectorResults) {
        const message = await this.getMessageContent(vectorResult.id);
        if (!message) continue;

        const messageTokens = this.estimateTokens(message.content);
        
        if (result.totalTokens + messageTokens <= maxTokens) {
          result.messages.push({
            id: vectorResult.id,
            content: message.content,
            createdAt: message.createdAt,
            score: vectorResult.score
          });
          result.totalTokens += messageTokens;
        } else {
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Error getting context window: ${error.message}`);
      // Return empty context on error
    }

    return result;
  }
} 