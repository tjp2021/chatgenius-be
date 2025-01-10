import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { NavigationState, NavigationTarget, TransitionResult } from '../types/navigation.types';

@Injectable()
export class NavigationService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultNavigationState(userId: string): Promise<NavigationState> {
    const channel = await this.prisma.channelMember.findFirst({
      where: { userId },
      include: { channel: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (!channel) {
      return { type: 'WELCOME' };
    }

    return {
      type: 'CHANNEL',
      channel: {
        id: channel.channel.id,
        name: channel.channel.name,
        type: channel.channel.type,
        unreadCount: 0,
      },
    };
  }

  async handleChannelTransition(userId: string, channelId: string): Promise<TransitionResult> {
    try {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          members: {
            where: { userId },
          },
        },
      });

      if (!channel || channel.members.length === 0) {
        return this.handleTransitionError(
          new Error('Channel not found or user not a member'),
          1
        );
      }

      await this.updateNavigationHistory(userId, channel.id);

      return {
        success: true,
        state: {
          type: 'CHANNEL',
          channel: {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            unreadCount: 0,
          },
        },
      };
    } catch (error) {
      return this.handleTransitionError(error, 1);
    }
  }

  async updateNavigationHistory(userId: string, channelId: string) {
    // Get current max order
    const maxOrder = await this.prisma.channelNavigation.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    await this.prisma.channelNavigation.upsert({
      where: {
        userId_channelId: {
          userId,
          channelId,
        },
      },
      update: {
        viewedAt: new Date(),
      },
      create: {
        user: { connect: { id: userId } },
        channel: { connect: { id: channelId } },
        viewedAt: new Date(),
        order: (maxOrder?.order ?? 0) + 1,
      },
    });
  }

  async handleTransitionError(error: any, attempt: number): Promise<TransitionResult> {
    return {
      success: false,
      state: { type: 'WELCOME' },
      error: error.message || 'An unknown error occurred'
    };
  }
} 