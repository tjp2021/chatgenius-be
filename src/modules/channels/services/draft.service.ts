import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { SaveDraftDto } from '../dto/save-draft.dto';

@Injectable()
export class DraftService {
  constructor(private prisma: PrismaService) {}

  async saveDraft(data: { userId: string; channelId: string; deviceId: string; content: string }) {
    return this.prisma.channelDraft.upsert({
      where: {
        channelId_userId: {
          userId: data.userId,
          channelId: data.channelId,
        }
      },
      update: {
        content: data.content,
      },
      create: {
        user: { connect: { id: data.userId } },
        channel: { connect: { id: data.channelId } },
        content: data.content,
      },
    });
  }

  async getDraft(data: { userId: string; channelId: string; deviceId: string }) {
    return this.prisma.channelDraft.findUnique({
      where: {
        channelId_userId: {
          userId: data.userId,
          channelId: data.channelId,
        }
      },
    });
  }

  async deleteDraft(data: { userId: string; channelId: string; deviceId: string }) {
    return this.prisma.channelDraft.delete({
      where: {
        channelId_userId: {
          userId: data.userId,
          channelId: data.channelId,
        }
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