import { Module } from '@nestjs/common';
import { PrismaModule } from '../../lib/prisma.module';
import { ChannelsController } from './controllers/channels.controller';
import { ChannelsService } from './services/channels.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {} 