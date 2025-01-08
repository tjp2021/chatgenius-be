import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelType } from '@prisma/client';
import { NavigationState, NavigationTarget, TransitionResult } from './types';

const MAX_TRANSITION_ATTEMPTS = 3;
const MAX_HISTORY_ENTRIES = 10;

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get the default navigation state for a user
   * Follows PRD priority: Public -> Private -> DM -> Welcome
   */
  async getDefaultNavigationState(userId: string): Promise<NavigationState> {
    // Get total channel count first
    const totalChannels = await this.prisma.channelMember.count({
      where: { userId }
    });

    // If no channels, show welcome screen
    if (totalChannels === 0) {
      return { type: 'WELCOME' };
    }

    // If only one channel, return it
    if (totalChannels === 1) {
      const onlyChannel = await this.prisma.channelMember.findFirst({
        where: { userId },
        include: { channel: true }
      });

      return {
        type: 'CHANNEL',
        channel: await this.buildNavigationTarget(userId, onlyChannel!.channelId)
      };
    }

    // Try to find channels in priority order: Public -> Private -> DM
    const channelTypes = [ChannelType.PUBLIC, ChannelType.PRIVATE, ChannelType.DM];
    
    for (const type of channelTypes) {
      const channel = await this.prisma.channelMember.findFirst({
        where: {
          userId,
          channel: { type }
        },
        orderBy: { joinedAt: 'asc' },
        include: { channel: true }
      });

      if (channel) {
        return {
          type: 'CHANNEL',
          channel: await this.buildNavigationTarget(userId, channel.channelId)
        };
      }
    }

    return { type: 'WELCOME' };
  }

  /**
   * Handle channel transition with retries and history tracking
   */
  async handleChannelTransition(
    userId: string,
    fromChannelId: string,
    attempt: number = 1
  ): Promise<TransitionResult> {
    try {
      // 1. Begin transition
      const nextState = await this.getNextChannel(userId, fromChannelId);
      
      // 2. Update navigation history
      if (nextState.type === 'CHANNEL') {
        await this.updateNavigationHistory(userId, nextState.channel!.channelId);
      }

      // 3. Mark previous channel as read
      if (fromChannelId) {
        await this.markChannelAsRead(userId, fromChannelId);
      }

      return {
        success: true,
        state: nextState
      };

    } catch (error) {
      this.logger.error(`Channel transition failed (attempt ${attempt}):`, error);

      // Retry logic as per PRD
      if (attempt < MAX_TRANSITION_ATTEMPTS) {
        return this.handleChannelTransition(userId, fromChannelId, attempt + 1);
      }

      return {
        success: false,
        state: await this.getDefaultNavigationState(userId),
        error: {
          code: 'TRANSITION_FAILED',
          message: 'Failed to transition after maximum attempts',
          attempt
        }
      };
    }
  }

  private async buildNavigationTarget(
    userId: string,
    channelId: string
  ): Promise<NavigationTarget> {
    const [channel, member, previousChannel] = await Promise.all([
      this.prisma.channel.findUnique({
        where: { id: channelId }
      }),
      this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId
          }
        }
      }),
      this.getPreviousChannel(userId)
    ]);

    if (!channel || !member) {
      throw new Error('Channel or membership not found');
    }

    return {
      channelId,
      type: channel.type,
      previousChannelId: previousChannel?.channelId,
      lastViewedAt: member.lastReadAt,
      unreadState: member.unreadCount > 0
    };
  }

  private async getPreviousChannel(userId: string) {
    return this.prisma.channelNavigation.findFirst({
      where: { userId },
      orderBy: { order: 'desc' }
    });
  }

  private async updateNavigationHistory(userId: string, channelId: string) {
    // Get current highest order
    const lastEntry = await this.prisma.channelNavigation.findFirst({
      where: { userId },
      orderBy: { order: 'desc' }
    });

    const nextOrder = (lastEntry?.order ?? 0) + 1;

    // Add new entry and cleanup old ones in a transaction
    await this.prisma.$transaction([
      // Remove old entries if we exceed MAX_HISTORY_ENTRIES
      this.prisma.channelNavigation.deleteMany({
        where: {
          userId,
          order: { lte: nextOrder - MAX_HISTORY_ENTRIES }
        }
      }),
      // Add new entry
      this.prisma.channelNavigation.create({
        data: {
          userId,
          channelId,
          order: nextOrder,
          viewedAt: new Date()
        }
      })
    ]);
  }

  private async markChannelAsRead(userId: string, channelId: string) {
    await this.prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId
        }
      },
      data: {
        lastReadAt: new Date(),
        unreadCount: 0
      }
    });
  }

  /**
   * Get the next channel when leaving current channel
   * Follows PRD priority: Same type first, then Public -> Private -> DM -> Welcome
   */
  async getNextChannel(userId: string, currentChannelId: string): Promise<NavigationState> {
    // Get current channel type
    const current = await this.prisma.channel.findUnique({
      where: { id: currentChannelId },
      select: { type: true }
    });

    if (!current) {
      return this.getDefaultNavigationState(userId);
    }

    // First, try to find next channel of the same type
    const nextInSameType = await this.prisma.channelMember.findFirst({
      where: {
        userId,
        channelId: { not: currentChannelId },
        channel: { type: current.type }
      },
      select: {
        channelId: true,
        lastReadAt: true,
        unreadCount: true,
        channel: {
          select: {
            type: true
          }
        }
      },
      orderBy: { joinedAt: 'asc' }
    });

    if (nextInSameType) {
      return {
        type: 'CHANNEL',
        channel: {
          channelId: nextInSameType.channelId,
          type: nextInSameType.channel.type,
          lastViewedAt: nextInSameType.lastReadAt || new Date(),
          unreadState: nextInSameType.unreadCount > 0
        }
      };
    }

    // If no channel in same type, follow priority order
    const channelTypes = [ChannelType.PUBLIC, ChannelType.PRIVATE, ChannelType.DM];
    
    for (const type of channelTypes) {
      // Skip the current type as we already checked it
      if (type === current.type) continue;

      const channel = await this.prisma.channelMember.findFirst({
        where: {
          userId,
          channel: { type }
        },
        select: {
          channelId: true,
          lastReadAt: true,
          unreadCount: true,
          channel: {
            select: {
              type: true
            }
          }
        },
        orderBy: { joinedAt: 'asc' }
      });

      if (channel) {
        return {
          type: 'CHANNEL',
          channel: {
            channelId: channel.channelId,
            type: channel.channel.type,
            lastViewedAt: channel.lastReadAt || new Date(),
            unreadState: channel.unreadCount > 0
          }
        };
      }
    }

    // If no channels left, show welcome screen
    return { type: 'WELCOME' };
  }
} 