import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DraftService } from './draft.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DraftCleanupService {
  private readonly logger = new Logger(DraftCleanupService.name);

  constructor(
    private draftService: DraftService,
    private prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldDrafts() {
    this.logger.log('Starting draft cleanup job');

    // Get all users with drafts
    const usersWithDrafts = await this.prisma.channelDraft.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });

    let totalCleaned = 0;
    for (const { userId } of usersWithDrafts) {
      const count = await this.draftService.cleanupOldDrafts(userId);
      totalCleaned += count;
    }

    this.logger.log(`Cleaned up ${totalCleaned} old drafts`);
  }
} 