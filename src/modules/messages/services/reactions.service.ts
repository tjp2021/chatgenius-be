import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { CreateMessageReactionDto, DeleteMessageReactionDto, MessageReactionResponseDto } from '../dto/message-reaction.dto';

@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async addReaction(userId: string, messageId: string, dto: CreateMessageReactionDto): Promise<MessageReactionResponseDto> {
    // Verify message exists and user has access
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user has access to the channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: message.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this message');
    }

    // Create or get existing reaction
    const reaction = await this.prisma.reaction.upsert({
      where: {
        messageId_userId_type: {
          messageId,
          userId,
          type: dto.type,
        },
      },
      create: {
        messageId,
        userId,
        type: dto.type,
      },
      update: {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return {
      id: `${reaction.messageId}-${reaction.userId}-${reaction.type}`,
      type: reaction.type,
      messageId: reaction.messageId,
      userId: reaction.userId,
      user: reaction.user,
      createdAt: reaction.createdAt,
    };
  }

  async removeReaction(userId: string, messageId: string, dto: DeleteMessageReactionDto): Promise<void> {
    // Verify message exists and user has access
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user has access to the channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: message.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this message');
    }

    // Delete the reaction
    await this.prisma.reaction.delete({
      where: {
        messageId_userId_type: {
          messageId,
          userId,
          type: dto.type,
        },
      },
    });
  }

  async getReactions(userId: string, messageId: string): Promise<MessageReactionResponseDto[]> {
    // Verify message exists and user has access
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user has access to the channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: message.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this message');
    }

    // Get all reactions for the message
    const reactions = await this.prisma.reaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return reactions.map(reaction => ({
      id: `${reaction.messageId}-${reaction.userId}-${reaction.type}`,
      type: reaction.type,
      messageId: reaction.messageId,
      userId: reaction.userId,
      user: reaction.user,
      createdAt: reaction.createdAt,
    }));
  }
} 