import { Injectable, Logger, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import { AvatarAnalysis, AvatarAnalysisData } from '../interfaces/avatar.interface';
import { VectorStoreService } from './vector-store.service';

interface SearchMessagesOptions {
  userId?: string;
  channelId?: string;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private vectorStore: VectorStoreService,
  ) {}

  async onModuleInit() {
    try {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.openai = new OpenAI({ apiKey });
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI client:', error);
      throw error;
    }
  }

  async createUserAvatar(userId: string): Promise<AvatarAnalysis> {
    try {
      const messages = await this.prisma.message.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      });

      if (messages.length < 5) {
        throw new BadRequestException('Insufficient message history for analysis');
      }

      const messageAnalysis = await this.analyzeUserStyle(userId);
      
      const avatar = await this.prisma.userAvatar.create({
        data: {
          userId,
          analysis: JSON.stringify({
            messageAnalysis: {
              timestamp: new Date(),
              lastMessageId: messages[0].id,
              analysis: messageAnalysis.styleAnalysis
            }
          })
        }
      });

      const analysisData = JSON.parse(avatar.analysis as string) as AvatarAnalysisData;

      return {
        id: avatar.id,
        userId: avatar.userId,
        messageAnalysis: analysisData.messageAnalysis,
        updatedAt: avatar.updatedAt
      };
    } catch (error) {
      this.logger.error('Error creating user avatar:', error);
      throw error;
    }
  }

  async generateAvatarResponse(userId: string, prompt: string): Promise<string> {
    try {
      const avatar = await this.prisma.userAvatar.findUnique({
        where: { userId }
      });

      if (!avatar) {
        throw new BadRequestException('Avatar not found. Please create an avatar first.');
      }

      const analysisData = JSON.parse(avatar.analysis as string) as AvatarAnalysisData;
      const style = analysisData.messageAnalysis.analysis;

      // Find relevant context
      const searchResult = await this.vectorStore.findSimilarMessages(prompt);
      const messages = searchResult.messages || [];
      
      // Group messages by thread and include parent messages
      const threadGroups = new Map<string, { messages: any[], score: number }>();
      messages.forEach(msg => {
        const threadId = msg.metadata?.replyTo || msg.id;
        const existing = threadGroups.get(threadId) || { messages: [], score: 0 };
        existing.messages.push(msg);
        existing.score = Math.max(existing.score, msg.score || 0);
        threadGroups.set(threadId, existing);
      });

      // Sort threads by highest message score and take top 2 threads
      const topThreads = Array.from(threadGroups.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      // Format context messages, including thread structure
      const contextMessages = topThreads
        .map(thread => thread.messages
          .sort((a, b) => new Date(a.metadata?.timestamp || 0).getTime() - new Date(b.metadata?.timestamp || 0).getTime())
          .map(msg => msg.content)
          .join('\n  ↪ ') // Show reply structure
        )
        .join('\n\n');
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: `You are an AI avatar mimicking a user's communication style. Here are the style characteristics to follow:
- Tone: ${style.tone}
- Vocabulary Level: ${style.vocabulary}
- Message Length: ${style.messageLength}
- Common Phrases: ${style.commonPhrases.join(', ')}

Here are some examples of their past relevant message threads for context:
${contextMessages}

Generate a response that matches these exact style characteristics. The response should be ${style.messageLength} in length, use ${style.vocabulary} vocabulary, maintain a ${style.tone} tone, and naturally incorporate their common phrases when appropriate.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0].message?.content || '';
    } catch (error) {
      this.logger.error('Error generating avatar response:', error);
      throw error;
    }
  }

  async analyzeUserStyle(userId: string) {
    try {
      const userMessages = await this.prisma.message.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          content: true,
          createdAt: true,
        },
      });

      if (userMessages.length < 5) {
        throw new BadRequestException('Insufficient message history to determine style');
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: `Analyze the communication style in these messages and return a JSON object with exactly these fields:
              - tone: (formal/casual/technical)
              - vocabulary: (advanced/simple/technical)
              - messageLength: (short/medium/long)
              - commonPhrases: [array of up to 3 common phrases]`
          },
          {
            role: 'user',
            content: userMessages.map(msg => msg.content).join('\n')
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 300,
      });

      const analysis = JSON.parse(completion.choices[0].message?.content || '{}');
      
      return {
        userId,
        messageCount: userMessages.length,
        styleAnalysis: {
          ...analysis,
          confidence: Math.min(userMessages.length / 20, 1)
        }
      };
    } catch (error) {
      this.logger.error('Error analyzing user style:', error);
      throw error;
    }
  }

  async gatherChannelContext(channelId: string) {
    const messages = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return messages;
  }

  async synthesizeResponse(channelId: string, prompt: string) {
    try {
      // Get relevant messages
      const searchResult = await this.vectorStore.findSimilarMessages(prompt);
      const messages = searchResult.messages || [];

      if (messages.length === 0) {
        return {
          response: "I couldn't find any relevant context to answer your question.",
          contextMessageCount: 0
        };
      }

      // Format messages for context
      const contextMessages = messages
        .map(msg => `[${msg.metadata?.timestamp || 'unknown'}] ${msg.content}`)
        .join('\n');

      // Generate response using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Use the provided context to answer questions specifically based on the information available. If the context contains specific information about our system or processes, use that information in your response.'
          },
          {
            role: 'user',
            content: `Based on the following context from our system, answer this question:

Context:
${contextMessages}

Question: ${prompt}

Please provide a specific answer based on the context provided. If the context contains specific information about our system or processes, use that information in your response.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return {
        response: completion.choices[0].message?.content || 'No response generated',
        contextMessageCount: messages.length
      };
    } catch (error) {
      this.logger.error('Error generating response:', error);
      throw error;
    }
  }

  async analyzeChannelConversations(channelId: string) {
    return {
      channelId,
      analysis: 'Mocked analysis'
    };
  }

  async generateStyledResponse(userId: string, prompt: string) {
    return {
      response: 'Mocked styled response'
    };
  }

  async extractDocumentContent(fileId: string): Promise<string> {
    // 1. Get file metadata from database
    const file = await this.prisma.file.findUnique({
      where: { id: fileId }
    });

    if (!file) {
      throw new BadRequestException('File not found');
    }

    // 2. Validate file type
    const supportedTypes = ['text/plain', 'text/markdown', 'application/pdf'];
    if (!supportedTypes.includes(file.type)) {
      throw new BadRequestException(`Unsupported file type: ${file.type}`);
    }

    // 3. Read file content
    try {
      if (file.type === 'application/pdf') {
        this.logger.debug(`Reading PDF file from: ${file.url}`);
        const buffer = await fs.promises.readFile(file.url);
        this.logger.debug(`PDF file size: ${buffer.length} bytes`);
        const data = await pdfParse(buffer);
        this.logger.debug(`PDF text extracted, length: ${data.text.length}`);
        return data.text;
      } else {
        const content = await fs.promises.readFile(file.url, 'utf8');
        return content;
      }
    } catch (error) {
      this.logger.error(`Failed to read file content: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw new BadRequestException('Failed to read file content');
    }
  }

  async updateUserAvatar(userId: string): Promise<AvatarAnalysis> {
    try {
      // 1. Verify avatar exists
      const existingAvatar = await this.prisma.userAvatar.findUnique({
        where: { userId }
      });

      if (!existingAvatar) {
        throw new NotFoundException('Avatar not found');
      }

      // 2. Get new message analysis
      const messageAnalysis = await this.analyzeUserStyle(userId);
      
      // 3. Get latest message for lastMessageId
      const latestMessages = await this.prisma.message.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true }
      });

      // 4. Update avatar with new analysis
      const updatedAvatar = await this.prisma.userAvatar.update({
        where: { userId },
        data: {
          analysis: JSON.stringify({
            messageAnalysis: {
              timestamp: new Date(),
              lastMessageId: latestMessages[0]?.id,
              analysis: messageAnalysis.styleAnalysis
            }
          })
        }
      });

      const analysisData = JSON.parse(updatedAvatar.analysis as string) as AvatarAnalysisData;

      return {
        id: updatedAvatar.id,
        userId: updatedAvatar.userId,
        messageAnalysis: analysisData.messageAnalysis,
        updatedAt: updatedAvatar.updatedAt
      };
    } catch (error) {
      this.logger.error('Error updating user avatar:', error);
      throw error;
    }
  }

  async searchMessages(query: string, options: SearchMessagesOptions = {}) {
    try {
      const { userId, channelId, limit = 50, startDate, endDate } = options;

      // Build where clause
      const where: any = {
        content: {
          contains: query,
          mode: 'insensitive'
        }
      };

      if (userId) where.userId = userId;
      if (channelId) where.channelId = channelId;
      if (startDate) where.createdAt = { gte: startDate };
      if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };

      const messages = await this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          content: true,
          createdAt: true,
          userId: true,
          channelId: true
        }
      });

      return messages;
    } catch (error) {
      this.logger.error('Error searching messages:', error);
      throw error;
    }
  }
} 