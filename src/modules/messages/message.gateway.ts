import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { MessageEvent } from './dto/message-events.enum';
import { MessageService } from './message.service';
import { BaseGateway } from '../../core/ws/base.gateway';
import { EventService } from '../../core/events/event.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  },
  transports: ['websocket']
})
export class MessageGateway extends BaseGateway {
  constructor(
    private readonly messageService: MessageService,
    protected readonly eventService: EventService
  ) {
    super(eventService);
  }

  async handleConnection(client: AuthenticatedSocket) {
    await super.handleConnection(client);
    
    // Get user's channels and join their rooms
    const userId = this.getClientUserId(client);
    if (userId) {
      const channels = await this.messageService.getUserChannels(userId);
      channels.forEach(channel => {
        client.join(`channel:${channel.id}`);
        this.eventService.subscribe(channel.id, client.id, userId);
      });
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.getClientUserId(client);
    if (userId) {
      const channels = await this.messageService.getUserChannels(userId);
      channels.forEach(channel => {
        this.eventService.unsubscribe(channel.id, client.id, userId);
        client.leave(`channel:${channel.id}`);
      });
    }
    await super.handleDisconnect(client);
  }

  @SubscribeMessage(MessageEvent.SEND)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string; content: string }
  ) {
    try {
      // Get user ID from socket
      const userId = this.getClientUserId(client);
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure client is in the channel room
      if (!client.rooms.has(`channel:${data.channelId}`)) {
        client.join(`channel:${data.channelId}`);
        this.eventService.subscribe(data.channelId, client.id, userId);
      }

      // Create message
      const message = await this.messageService.create(userId, {
        channelId: data.channelId,
        content: data.content
      });

      return this.success(message);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage(MessageEvent.DELIVERED)
  async handleMessageDelivered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string }
  ) {
    try {
      const userId = this.getClientUserId(client);
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await this.messageService.markAsDelivered(data.messageId, userId);
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage(MessageEvent.READ)
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string }
  ) {
    try {
      const userId = this.getClientUserId(client);
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await this.messageService.markAsSeen(data.messageId, userId);
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }
} 