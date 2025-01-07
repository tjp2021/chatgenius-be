import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { ChannelsModule } from '../channels/channels.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [
    ChannelsModule,
    MessageModule
  ],
  providers: [SocketGateway],
  exports: [SocketGateway]
})
export class GatewayModule {} 