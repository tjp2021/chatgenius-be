import { Module } from '@nestjs/common';
import { ChannelInvitationService } from './services/channel-invitation.service';
import { ChannelInvitationGateway } from '../../core/ws/channel-invitation.gateway';
import { CoreModule } from '../../core/core.module';
import { RedisCacheModule } from '../../core/cache/redis.module';

@Module({
  imports: [CoreModule, RedisCacheModule],
  providers: [ChannelInvitationService, ChannelInvitationGateway],
  exports: [ChannelInvitationService],
})
export class ChannelInvitationModule {} 