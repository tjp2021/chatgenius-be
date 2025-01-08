import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import type { ChannelDraft } from '@prisma/client';

@Injectable()
export class DraftService {
  constructor(private prisma: PrismaService) {}

  async saveDraft(
    userId: string,
    channelId: string,
    data: SaveDraftDto
  ): Promise<ChannelDraft> {
    // First verify user has access to the channel
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Channel not found or not a member');
    }

    // Upsert the draft
    return this.prisma.channelDraft.upsert({
      where: {
        userId_channelId_deviceId: {
          userId,
          channelId,
          deviceId: data.deviceId || null,
        },
      },
      create: {
        userId,
        channelId,
        content: data.content,
        deviceId: data.deviceId,
      },
      update: {
        content: data.content,
      },
    });
  }

  async getDraft(
    userId: string,
    channelId: string,
    deviceId?: string
  ): Promise<ChannelDraft | null> {
    return this.prisma.channelDraft.findUnique({
      where: {
        userId_channelId_deviceId: {
          userId,
          channelId,
          deviceId: deviceId || null,
        },
      },
    });
  }

  async deleteDraft(
    userId: string,
    channelId: string,
    deviceId?: string
  ): Promise<void> {
    await this.prisma.channelDraft.delete({
      where: {
        userId_channelId_deviceId: {
          userId,
          channelId,
          deviceId: deviceId || null,
        },
      },
    });
  }

  async cleanupOldDrafts(userId: string): Promise<number> {
    // Delete drafts older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count } = await this.prisma.channelDraft.deleteMany({
      where: {
        userId,
        updatedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    return count;
  }
} 