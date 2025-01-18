import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ResponseSynthesisService } from './response-synthesis.service';
import { IAvatarService } from '../interfaces/avatar.service.interface';
import { AvatarAnalysis, AvatarAnalysisData } from '../interfaces/avatar.interface';
import { VectorStoreService } from './vector-store.service';

@Injectable()
export class AvatarService implements IAvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly MIN_MESSAGES_REQUIRED = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly synthesis: ResponseSynthesisService,
    private readonly vectorStore: VectorStoreService
  ) {}

  private validateStyleAnalysis(response: string) {
    try {
      const analysis = JSON.parse(response);
      if (!analysis.tone || !analysis.vocabulary || 
          !['formal', 'casual'].includes(analysis.tone) ||
          !['technical', 'simple'].includes(analysis.vocabulary)) {
        throw new BadRequestException('Invalid style analysis format');
      }
      return analysis;
    } catch (e) {
      throw new BadRequestException('Invalid style analysis response');
    }
  }

  async createAvatar(userId: string): Promise<AvatarAnalysis> {
    try {
      // Get user's messages
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

      if (messages.length < this.MIN_MESSAGES_REQUIRED) {
        throw new BadRequestException('Insufficient message history for analysis');
      }

      // Analyze user's style
      const messageTexts = messages.map(msg => msg.content).join('\n');
      const styleAnalysis = await this.synthesis.synthesizeResponse({
        channelId: 'style-analysis',
        prompt: `Analyze this user's communication style and return a JSON object with exactly these fields:
{
  "tone": "formal" or "casual",
  "vocabulary": "technical" or "simple"
}

Here are their messages:

${messageTexts}`
      });

      // Validate the response
      const analysis = this.validateStyleAnalysis(styleAnalysis.response);
      
      // Create avatar record
      const avatar = await this.prisma.userAvatar.create({
        data: {
          userId,
          analysis: JSON.stringify({
            messageAnalysis: {
              timestamp: new Date(),
              lastMessageId: messages[0].id,
              analysis
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

  async generateResponse(userId: string, prompt: string): Promise<string> {
    try {
      if (!prompt.trim()) {
        throw new BadRequestException('Prompt cannot be empty');
      }

      // Get avatar
      const avatar = await this.prisma.userAvatar.findUnique({
        where: { userId }
      });

      if (!avatar) {
        throw new BadRequestException('Avatar not found. Please create an avatar first.');
      }

      const analysisData = JSON.parse(avatar.analysis as string) as AvatarAnalysisData;

      // Find relevant context
      const searchResult = await this.vectorStore.findSimilarMessages(prompt);
      const messages = searchResult.messages || [];
      const contextMessages = messages.map(msg => msg.metadata?.content || '').join('\n');

      // Generate response using style
      const response = await this.synthesis.synthesizeResponse({
        channelId: 'avatar-response',
        prompt: `You are an AI avatar mimicking this user's style. Here's their analyzed style:
${JSON.stringify(analysisData.messageAnalysis.analysis)}

Here's some context from their previous messages:
${contextMessages}

Generate a response to this prompt that perfectly matches their communication style:
${prompt}`
      });

      return response.response;
    } catch (error) {
      this.logger.error('Error generating avatar response:', error);
      throw error;
    }
  }

  async updateAvatar(userId: string): Promise<AvatarAnalysis> {
    try {
      // Verify avatar exists
      const existingAvatar = await this.prisma.userAvatar.findUnique({
        where: { userId }
      });

      if (!existingAvatar) {
        throw new NotFoundException('Avatar not found');
      }

      // Get new messages for analysis
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

      if (messages.length < this.MIN_MESSAGES_REQUIRED) {
        throw new BadRequestException('Insufficient message history for analysis');
      }

      // Generate new style analysis
      const messageTexts = messages.map(msg => msg.content).join('\n');
      const styleAnalysis = await this.synthesis.synthesizeResponse({
        channelId: 'style-analysis',
        prompt: `Analyze this user's communication style and return a JSON object with exactly these fields:
{
  "tone": "formal" or "casual",
  "vocabulary": "technical" or "simple"
}

Here are their messages:

${messageTexts}`
      });

      // Validate the response
      const analysis = this.validateStyleAnalysis(styleAnalysis.response);

      // Update avatar
      const updatedAvatar = await this.prisma.userAvatar.update({
        where: { userId },
        data: {
          analysis: JSON.stringify({
            messageAnalysis: {
              timestamp: new Date(),
              lastMessageId: messages[0].id,
              analysis
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
} 