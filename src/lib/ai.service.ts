import { Injectable, Logger, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;
  private readonly MAX_CONTEXT_MESSAGES = 50;
  private readonly MIN_CONTEXT_MESSAGES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }

      this.openai = new OpenAI({
        apiKey,
      });
      this.logger.log('OpenAI client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI client:', error);
      throw error;
    }
  }

  /**
   * Gather context messages from a channel
   */
  async gatherChannelContext(channelId: string, limit = this.MAX_CONTEXT_MESSAGES) {
    // First verify the channel exists
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException(`Channel with ID ${channelId} not found`);
    }

    const messages = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (messages.length < this.MIN_CONTEXT_MESSAGES) {
      throw new BadRequestException(`Channel has insufficient context (minimum ${this.MIN_CONTEXT_MESSAGES} messages required)`);
    }

    return messages.reverse(); // Return in chronological order
  }

  /**
   * Format messages for LLM context
   */
  private formatMessagesForContext(messages: any[]) {
    return messages.map(msg => ({
      role: 'user',
      name: msg.user.name,
      content: msg.content,
    }));
  }

  /**
   * Generate a synthesized response based on channel context
   */
  async synthesizeResponse(channelId: string, prompt: string) {
    if (!prompt?.trim()) {
      throw new BadRequestException('Prompt cannot be empty');
    }

    try {
      // Gather recent messages for context
      const contextMessages = await this.gatherChannelContext(channelId);
      const formattedMessages = this.formatMessagesForContext(contextMessages);

      // Prepare the system message
      const systemMessage = {
        role: 'system',
        content: `You are a helpful AI assistant in a chat channel. Your task is to synthesize information from the conversation and provide a thoughtful response to the user's question. Use the chat history as context to provide accurate and relevant answers. Be concise but thorough.

Context: This is a chat channel where users discuss various topics. The recent message history is provided below. Use this context to inform your response.

Question: ${prompt}`,
      };

      // Combine system message with context
      const messages = [systemMessage, ...formattedMessages];

      // Generate response using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 500,
      });

      if (!completion.choices?.[0]?.message?.content) {
        throw new Error('No response generated from OpenAI');
      }

      return {
        response: completion.choices[0].message.content,
        contextMessageCount: contextMessages.length,
      };
    } catch (error) {
      this.logger.error('Error synthesizing response:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      if (error.response?.status === 429) {
        throw new BadRequestException('Rate limit exceeded. Please try again later.');
      }

      if (error.response?.status === 400) {
        throw new BadRequestException('Request to AI service failed. Context might be too long.');
      }

      throw new Error('Failed to generate AI response. Please try again later.');
    }
  }
} 