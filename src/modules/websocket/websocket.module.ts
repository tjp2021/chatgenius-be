import { Module } from '@nestjs/common';
import { ChatGateway } from './gateways/chat.gateway';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';
import { WebsocketService } from './services/websocket.service';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [ChannelsModule, UsersModule, MessagesModule],
  providers: [ChatGateway, WebsocketService],
  exports: [ChatGateway]
})
export class WebSocketModule {} 