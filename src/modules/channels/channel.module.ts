import { Module } from '@nestjs/common';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { PrismaChannelRepository } from './channel.repository';
import { CoreModule } from '../../core/core.module';
import { ChannelInvitationModule } from './channel-invitation.module';
import { ChannelGateway } from './channel.gateway';

@Module({
  imports: [CoreModule, ChannelInvitationModule],
  controllers: [ChannelController],
  providers: [ChannelService, PrismaChannelRepository, ChannelGateway],
  exports: [ChannelService],
})
export class ChannelModule {} 