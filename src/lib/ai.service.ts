import { Injectable, Logger, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import { AvatarAnalysis, AvatarUpdateOptions, AvatarAnalysisData } from '../interfaces/avatar.interface';
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

      // 1. Find relevant context
      const similarMessages = await this.vectorStore.findSimilarMessages(prompt);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: `You are an AI avatar mimicking this user's style. Here's their analyzed style:
${analysisData.messageAnalysis.analysis}

Generate a response that perfectly matches their communication style.`
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
        take: 10,
        select: {
          content: true,
          createdAt: true,
        },
      });

      if (userMessages.length < 5) {
        throw new BadRequestException('Insufficient message history to determine style');
      }

      // Generate response using style context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: 'Analyze the communication style in these messages. Focus on: tone, vocabulary level, typical message length, and common phrases.'
          },
          {
            role: 'user',
            content: userMessages.map(msg => msg.content).join('\n')
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      return {
        userId,
        messageCount: userMessages.length,
        styleAnalysis: completion.choices[0].message?.content
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
    return {
      response: 'Mocked response',
      contextMessageCount: 0
    };
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