import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { MessageGateway } from './message.gateway';
import { ChannelInvitationGateway } from './channel-invitation.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelsModule } from '../channels/channels.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, ChannelsModule, AuthModule],
  providers: [SocketGateway, MessageGateway, ChannelInvitationGateway],
  exports: [SocketGateway, MessageGateway, ChannelInvitationGateway]
})
export class GatewayModule {} 