import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { ChannelService } from './channel.service';
import { ChannelGateway } from './channel.gateway';
import { PrismaChannelRepository } from './channel.repository';
import { ChannelController } from './channel.controller';

@Module({
  imports: [CoreModule],
  providers: [
    ChannelService,
    ChannelGateway,
    PrismaChannelRepository,
  ],
  controllers: [ChannelController],
  exports: [ChannelService],
})
export class ChannelModule {} 