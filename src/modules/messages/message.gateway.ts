import { SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { BaseGateway } from '../../core/ws/base.gateway';
import { EventService } from '../../core/events/event.service';
import { MessageService } from './message.service';
import { TypingIndicatorService } from './services/typing-indicator.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';

@Injectable()
export class MessageGateway extends BaseGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    protected readonly eventService: EventService,
    private readonly messageService: MessageService,
    private readonly typingService: TypingIndicatorService,
  ) {
    super(eventService);
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    if (!this.validateClient(client)) {
      return;
    }
    
    // Process any offline messages when user connects
    const userId = this.getClientUserId(client);
    await this.messageService.handleUserOnline(userId);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = this.getClientUserId(client);
    if (userId) {
      await this.typingService.handleUserDisconnect(userId);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    client: AuthenticatedSocket,
    @MessageBody() data: CreateMessageDto,
  ) {
    try {
      const message = await this.messageService.create(this.getClientUserId(client), data);
      return this.success(message);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('message:delivered')
  async handleMessageDelivered(
    client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      await this.messageService.markAsDelivered(
        data.messageId,
        this.getClientUserId(client)
      );
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('message:seen')
  async handleMessageSeen(
    client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      await this.messageService.markAsSeen(
        data.messageId,
        this.getClientUserId(client)
      );
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('message:getStatus')
  async handleGetMessageStatus(
    client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      const status = await this.messageService.getMessageDeliveryStatus(data.messageId);
      return this.success(status);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('updateMessage')
  async handleUpdateMessage(
    client: AuthenticatedSocket,
    @MessageBody() data: UpdateMessageDto,
  ) {
    try {
      const message = await this.messageService.update(
        data.messageId,
        this.getClientUserId(client),
        data.content
      );
      return this.success(message);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      await this.messageService.delete(data.messageId, this.getClientUserId(client));
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      if (!this.eventService.isSubscribed(data.channelId, this.getClientUserId(client))) {
        throw new Error('Not subscribed to channel');
      }

      await this.typingService.setTyping(
        this.getClientUserId(client),
        data.channelId
      );

      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('typing:stop')
  async handleStopTyping(
    client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      await this.typingService.clearTyping(
        this.getClientUserId(client),
        data.channelId
      );
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('typing:get')
  async handleGetTypingUsers(
    client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      const typingUsers = await this.typingService.getTypingUsers(data.channelId);
      return this.success(typingUsers);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('message:getOfflineCount')
  async handleGetOfflineMessageCount(client: AuthenticatedSocket) {
    try {
      const count = await this.messageService.getOfflineMessageCount(
        this.getClientUserId(client)
      );
      return this.success({ count });
    } catch (error) {
      return this.error(error.message);
    }
  }
} 