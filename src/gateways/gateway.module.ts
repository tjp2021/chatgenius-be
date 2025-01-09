import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { ChannelsModule } from '../channels/channels.module';
import { MessageModule } from '../message/message.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ChannelsModule,
    MessageModule,
    AuthModule
  ],
  providers: [SocketGateway],
  exports: [SocketGateway]
})
export class GatewayModule {} 