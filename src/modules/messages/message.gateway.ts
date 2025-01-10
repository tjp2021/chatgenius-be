import { UseGuards } from '@nestjs/common';
import { SubscribeMessage } from '@nestjs/websockets';
import { WebSocketGateway } from '../../core/ws/ws.gateway';
import { AuthenticatedSocket } from '../../core/ws/ws.types';
import { CreateMessageDto, UpdateMessageDto } from './message.types';
import { MessageService } from './message.service';
import { WsGuard } from '../../shared/guards/ws.guard';

@UseGuards(WsGuard)
export class MessageGateway extends WebSocketGateway {
  constructor(private messageService: MessageService) {
    super();
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(client: AuthenticatedSocket, payload: CreateMessageDto) {
    try {
      const message = await this.messageService.create(client.userId, payload);
      return this.success(message);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('message:update')
  async handleUpdateMessage(client: AuthenticatedSocket, payload: UpdateMessageDto) {
    try {
      const message = await this.messageService.update(client.userId, payload);
      return this.success(message);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(client: AuthenticatedSocket, messageId: string) {
    try {
      await this.messageService.delete(client.userId, messageId);
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }
} 