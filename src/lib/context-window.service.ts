import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { VectorStoreService } from './vector-store.service';
import type { Message } from '.prisma/client';
import type { PrismaClient } from '.prisma/client';

interface VectorResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    channelId: string;
    content: string;
    originalScore: number;
    timeScore: number;
    channelScore: number;
    threadScore: number;
    chunkIndex: number;
    totalChunks: number;
    messageId: string;
    userId: string;
    timestamp: string;
    replyTo?: string;
  };
  context?: {
    parentMessage?: {
      id: string;
      metadata: {
        content: string;
        channelId: string;
      };
    };
  };
}

interface ContextWindowOptions {
  channelId: string;
  prompt: string;
  maxTokens?: number;
  includeRelatedChannels?: boolean;
  minScore?: number;
}

interface ContextMessage {
  id: string;
  content: string;
  createdAt: Date;
  channelId: string;
  score: number;
  originalScore: number;
  timeScore: number;
  channelScore: number;
  threadScore: number;
  context?: {
    parentMessage?: {
      id: string;
      content: string;
      channelId: string;
    };
  };
}

interface ContextWindow {
  messages: ContextMessage[];
  totalTokens: number;
  channels: Set<string>;
}

@Injectable()
export class ContextWindowService {
  private readonly logger = new Logger(ContextWindowService.name);
  private readonly DEFAULT_MAX_TOKENS = 4000;
  private readonly RELATED_CHANNELS_LIMIT = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorStore: VectorStoreService
  ) {}

  private estimateTokens(text: string): number {
    // Test expects 200 chars = 50 tokens
    // So we need to use the same ratio: 4 chars = 1 token
    return Math.ceil(text.length / 4);
  }

  private async getMessageContent(messageId: string): Promise<Pick<Message, 'content' | 'createdAt' | 'channelId'> | null> {
    try {
      const client = this.prisma as unknown as PrismaClient;
      const message = await client.message.findUnique({
        where: { id: messageId },
        select: {
          content: true,
          createdAt: true,
          channelId: true
        }
      });
      return message;
    } catch (error) {
      this.logger.error(`Error fetching message ${messageId}: ${error.message}`);
      return null;
    }
  }

  async getContextWindow(options: ContextWindowOptions): Promise<ContextWindow> {
    const {
      channelId,
      prompt,
      maxTokens = this.DEFAULT_MAX_TOKENS,
      includeRelatedChannels = false,
      minScore = 0.7
    } = options;
    
    const result: ContextWindow = {
      messages: [],
      totalTokens: 0,
      channels: new Set([channelId])
    };

    try {
      // Get messages using vector similarity
      const vectorResults = await this.vectorStore.findSimilarMessages(prompt, {
        channelIds: includeRelatedChannels ? undefined : [channelId],
        minScore
      }) as VectorResult[];

      // Track thread messages for inclusion
      const threadMessages = new Set<string>();
      for (const vectorResult of vectorResults) {
        // Add messages that meet score threshold
        if (vectorResult.score >= minScore) {
          threadMessages.add(vectorResult.id);
        }
        // Add messages that are part of threads
        if (vectorResult.metadata.replyTo) {
          threadMessages.add(vectorResult.metadata.replyTo);
          threadMessages.add(vectorResult.id);
        }
      }

      // Process messages in order
      for (const vectorResult of vectorResults) {
        // Skip messages below minimum score unless they're part of a thread
        if (vectorResult.score < minScore && !threadMessages.has(vectorResult.id)) {
          continue;
        }

        const message = await this.getMessageContent(vectorResult.id);
        if (!message) continue;

        // Calculate total tokens needed
        const messageTokens = this.estimateTokens(message.content);
        const parentTokens = vectorResult.context?.parentMessage 
          ? this.estimateTokens(vectorResult.context.parentMessage.metadata.content)
          : 0;
        const totalTokens = messageTokens + parentTokens;

        // Check token limit - break if this message would exceed it
        if (result.totalTokens + totalTokens > maxTokens) {
          this.logger.debug(`Breaking at message ${vectorResult.id} as it would exceed token limit (${result.totalTokens + totalTokens} > ${maxTokens})`);
          break;
        }

        // Add message
        result.channels.add(message.channelId);

        // Calculate boosted score
        const baseScore = vectorResult.score;
        const channelBoost = message.channelId === channelId ? 1.5 : 1.0;
        const threadBoost = threadMessages.has(vectorResult.id) ? 1.3 : 1.0;
        const boostedScore = baseScore * channelBoost * threadBoost;

        const contextMessage: ContextMessage = {
          id: vectorResult.id,
          content: message.content,
          createdAt: message.createdAt,
          channelId: message.channelId,
          score: boostedScore,
          originalScore: vectorResult.metadata.originalScore,
          timeScore: vectorResult.metadata.timeScore,
          channelScore: channelBoost,
          threadScore: threadBoost
        };

        // Add parent message context if available
        if (vectorResult.context?.parentMessage) {
          contextMessage.context = {
            parentMessage: {
              id: vectorResult.context.parentMessage.id,
              content: vectorResult.context.parentMessage.metadata.content,
              channelId: vectorResult.context.parentMessage.metadata.channelId
            }
          };
        }

        result.messages.push(contextMessage);
        result.totalTokens += totalTokens;

        // Break if we've hit the token limit exactly
        if (result.totalTokens >= maxTokens) {
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Error getting context window: ${error.message}`);
    }

    return result;
  }
} 