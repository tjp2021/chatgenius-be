import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { MessageEvent } from './dto/message-events.enum';
import { MessageService } from './message.service';
import { BaseGateway } from '../../core/ws/base.gateway';
import { EventService } from '../../core/events/event.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { Logger } from '@nestjs/common';

@WebSocketGateway()
export class MessageGateway extends BaseGateway {
  protected readonly logger = new Logger(MessageGateway.name);

  constructor(
    private readonly messageService: MessageService,
    protected readonly eventService: EventService
  ) {
    super(eventService);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // First handle base connection logic
      await super.handleConnection(client);
      
      const userId = this.getClientUserId(client);
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get user's channels and subscribe to them via EventService
      const channels = await this.messageService.getUserChannels(userId);
      await Promise.all(channels.map(async channel => {
        await this.eventService.subscribe(channel.id, client.id, userId);
      }));

      this.logger.debug(`Client ${client.id} connected and subscribed to ${channels.length} channels`);
    } catch (error) {
      this.logger.error('Error in handleConnection:', error);
      client.emit('error', this.error(error.message));
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    try {
      const userId = this.getClientUserId(client);
      if (userId) {
        const channels = await this.messageService.getUserChannels(userId);
        await Promise.all(channels.map(async channel => {
          await this.eventService.unsubscribe(channel.id, client.id, userId);
        }));
      }
      await super.handleDisconnect(client);
    } catch (error) {
      this.logger.error('Error in handleDisconnect:', error);
    }
  }

  @SubscribeMessage(MessageEvent.SEND)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string; content: string }
  ) {
    try {
      const userId = this.getClientUserId(client);
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Verify channel subscription
      if (!this.eventService.isSubscribed(data.channelId, userId)) {
        await this.eventService.subscribe(data.channelId, client.id, userId);
      }

      // Create and broadcast message
      const message = await this.messageService.create(userId, {
        channelId: data.channelId,
        content: data.content
      });

      // Emit to channel via EventService
      this.eventService.emit(data.channelId, MessageEvent.NEW, message);

      return this.success(message);
    } catch (error) {
      this.logger.error('Error in handleSendMessage:', error);
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

      // Mark as delivered (this updates the delivery status)
      await this.messageService.markAsDelivered(data.messageId, userId);

      // Get the message to emit the update
      const message = await this.messageService.findById(data.messageId);
      if (message) {
        this.eventService.emit(message.channelId, 'message:status', {
          messageId: message.id,
          status: 'delivered',
          userId
        });
      }

      return this.success(true);
    } catch (error) {
      this.logger.error('Error in handleMessageDelivered:', error);
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

      // Mark as seen (this updates the delivery status)
      await this.messageService.markAsSeen(data.messageId, userId);

      // Get the message to emit the update
      const message = await this.messageService.findById(data.messageId);
      if (message) {
        this.eventService.emit(message.channelId, 'message:status', {
          messageId: message.id,
          status: 'read',
          userId
        });
      }

      return this.success(true);
    } catch (error) {
      this.logger.error('Error in handleMessageRead:', error);
      return this.error(error.message);
    }
  }
} 