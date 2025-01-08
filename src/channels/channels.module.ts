import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { DraftService } from './draft.service';
import { DraftController } from './draft.controller';
import { DraftCleanupService } from './draft-cleanup.service';
import { NavigationService } from './navigation.service';
import { NavigationController } from './navigation.controller';
import { BrowseService } from './browse.service';
import { BrowseController } from './browse.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisCacheModule } from '../cache/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisCacheModule,
    AuthModule,
  ],
  controllers: [
    ChannelsController,
    DraftController,
    NavigationController,
    BrowseController,
  ],
  providers: [
    ChannelsService,
    DraftService,
    DraftCleanupService,
    NavigationService,
    BrowseService,
  ],
  exports: [
    ChannelsService,
    DraftService,
    NavigationService,
    BrowseService,
  ],
})
export class ChannelsModule {} 