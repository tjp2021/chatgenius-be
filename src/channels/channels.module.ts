import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisCacheModule } from '../cache/redis.module';

@Module({
  imports: [PrismaModule, RedisCacheModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {} 