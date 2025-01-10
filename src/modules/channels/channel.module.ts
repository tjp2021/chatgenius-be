import { Module } from '@nestjs/common';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { PrismaChannelRepository } from './channel.repository';
import { CoreModule } from '../../core/core.module';
import { ChannelInvitationModule } from './channel-invitation.module';

@Module({
  imports: [CoreModule, ChannelInvitationModule],
  controllers: [ChannelController],
  providers: [ChannelService, PrismaChannelRepository],
  exports: [ChannelService],
})
export class ChannelModule {} 