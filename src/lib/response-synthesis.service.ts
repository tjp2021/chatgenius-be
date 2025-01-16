import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { ContextWindowService } from './context-window.service';
import { RateLimitService } from './rate-limit.service';

interface SynthesisOptions {
  channelId: string;
  prompt: string;
}

interface SynthesisResponse {
  response: string;
  contextMessageCount: number;
}

@Injectable()
export class ResponseSynthesisService {
  private readonly logger = new Logger(ResponseSynthesisService.name);
  private openai: OpenAI;
  private readonly MAX_RETRIES = 3;
  private readonly RATE_LIMIT = 50; // 50 requests per minute
  private readonly RATE_WINDOW = 60; // 1 minute window

  constructor(
    private readonly contextWindow: ContextWindowService,
    private readonly configService: ConfigService,
    private readonly rateLimit: RateLimitService
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.openai = new OpenAI({ apiKey });
  }

  private formatContextMessages(context: { messages: any[] }): string {
    if (!context.messages.length) return '';

    return context.messages
      .map(msg => `[${msg.createdAt.toISOString()}] ${msg.content}`)
      .join('\n');
  }

  protected getRetryDelay(retryCount: number): number {
    return Math.pow(2, retryCount) * 1000; // Exponential backoff
  }

  async synthesizeResponse(options: SynthesisOptions): Promise<SynthesisResponse> {
    // Check rate limit
    const isLimited = await this.rateLimit.isRateLimited(
      'openai_synthesis',
      this.RATE_LIMIT,
      this.RATE_WINDOW
    );

    if (isLimited) {
      this.logger.warn('Rate limit exceeded for response synthesis');
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        // Get relevant context
        const context = await this.contextWindow.getContextWindow({
          channelId: options.channelId,
          prompt: options.prompt
        });

        // Format context messages
        const contextText = this.formatContextMessages(context);

        // Generate response using OpenAI
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Use the provided context to answer questions, but also use your general knowledge when appropriate.'
            },
            {
              role: 'user',
              content: contextText ? 
                `Context:\n${contextText}\n\nQuestion: ${options.prompt}` :
                options.prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        });

        return {
          response: completion.choices[0].message?.content || 'No response generated',
          contextMessageCount: context.messages.length
        };
      } catch (error) {
        retries++;
        this.logger.error(`Attempt ${retries} failed: ${error.message}`);
        
        if (retries === this.MAX_RETRIES) {
          throw new Error('Failed to generate response after multiple attempts');
        }
        
        // Wait before retrying (using getRetryDelay)
        await new Promise(resolve => setTimeout(resolve, this.getRetryDelay(retries)));
      }
    }

    throw new Error('Failed to generate response');
  }
} 