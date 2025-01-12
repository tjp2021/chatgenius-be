import { Module } from '@nestjs/common';
import { ChatGateway } from './gateways/chat.gateway';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [ChannelsModule],
  providers: [ChatGateway],
  exports: [ChatGateway]
})
export class WebSocketModule {} 