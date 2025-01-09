import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MessageService } from '../message/message.service';
import { MessageEvent } from '../message/dto/message-events.enum';
import { MessageEventDto } from '../message/dto/message-event.dto';
import { TypingIndicatorDto, TypingStatus } from '../message/dto/typing-indicator.dto';
import { MessageDeliveryDto } from '../message/dto/message-delivery.dto';
import { MessageDeliveryStatus } from '../message/dto/message-events.enum';
import { RedisCacheService } from '../cache/redis.service';

@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL!, process.env.SOCKET_URL!],
    credentials: true
  },
})
export class MessageGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessageGateway.name);

  constructor(
    private messageService: MessageService,
    private cacheService: RedisCacheService,
  ) {}

  private handleError(client: Socket, error: any) {
    this.logger.error('WebSocket Error:', error);
    client.emit(MessageEvent.ERROR, {
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR'
    });
  }

  @SubscribeMessage(MessageEvent.SEND)
  async handleMessageSend(client: Socket, payload: MessageEventDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      // Create message
      const message = await this.messageService.create(userId, payload);

      // Broadcast to channel room
      this.server.to(`channel:${payload.channelId}`).emit(MessageEvent.NEW, message);
      
      // Confirm to sender
      client.emit(MessageEvent.SENT, {
        messageId: message.id,
        status: MessageDeliveryStatus.SENT
      });

      return message;
    } catch (error) {
      this.handleError(client, error);
    }
  }

  @SubscribeMessage(MessageEvent.DELIVERED)
  async handleMessageDelivered(client: Socket, payload: MessageDeliveryDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      const message = await this.messageService.updateDeliveryStatus(
        payload.messageId,
        userId,
        MessageDeliveryStatus.DELIVERED
      );

      // Notify sender of delivery
      this.server.to(`user:${message.userId}`).emit(MessageEvent.DELIVERED, {
        messageId: message.id,
        userId,
        status: MessageDeliveryStatus.DELIVERED
      });

      return message;
    } catch (error) {
      this.handleError(client, error);
    }
  }

  @SubscribeMessage(MessageEvent.READ)
  async handleMessageRead(client: Socket, payload: MessageDeliveryDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      const message = await this.messageService.updateDeliveryStatus(
        payload.messageId,
        userId,
        MessageDeliveryStatus.READ
      );

      // Notify sender of read status
      this.server.to(`user:${message.userId}`).emit(MessageEvent.READ, {
        messageId: message.id,
        userId,
        status: MessageDeliveryStatus.READ
      });

      return message;
    } catch (error) {
      this.handleError(client, error);
    }
  }

  @SubscribeMessage(MessageEvent.TYPING_START)
  async handleTypingStart(client: Socket, payload: TypingIndicatorDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      const typingStatus: TypingStatus = {
        userId,
        channelId: payload.channelId,
        isTyping: true,
        timestamp: new Date()
      };

      await this.cacheService.setTypingStatus(payload.channelId, typingStatus);

      // Broadcast typing status to channel
      this.server.to(`channel:${payload.channelId}`).emit(MessageEvent.TYPING_START, {
        userId,
        channelId: payload.channelId
      });
    } catch (error) {
      this.handleError(client, error);
    }
  }

  @SubscribeMessage(MessageEvent.TYPING_STOP)
  async handleTypingStop(client: Socket, payload: TypingIndicatorDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      const typingStatus: TypingStatus = {
        userId,
        channelId: payload.channelId,
        isTyping: false,
        timestamp: new Date()
      };

      await this.cacheService.setTypingStatus(payload.channelId, typingStatus);

      // Broadcast typing status to channel
      this.server.to(`channel:${payload.channelId}`).emit(MessageEvent.TYPING_STOP, {
        userId,
        channelId: payload.channelId
      });
    } catch (error) {
      this.handleError(client, error);
    }
  }

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      // Join user's personal room for direct messages
      client.join(`user:${userId}`);

      // Get and deliver any offline messages
      const offlineMessages = await this.messageService.getOfflineMessages(userId);
      if (offlineMessages.length > 0) {
        client.emit(MessageEvent.OFFLINE_MESSAGES, offlineMessages);
      }
    } catch (error) {
      this.handleError(client, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.handshake.auth.userId;
      if (userId) {
        // Clear typing status in all channels
        const rooms = client.rooms;
        for (const room of rooms) {
          if (room.startsWith('channel:')) {
            const channelId = room.replace('channel:', '');
            const typingStatus: TypingStatus = {
              userId,
              channelId,
              isTyping: false,
              timestamp: new Date()
            };
            
            await this.cacheService.setTypingStatus(channelId, typingStatus);
            
            // Notify channel that user stopped typing
            this.server.to(room).emit(MessageEvent.TYPING_STOP, {
              userId,
              channelId
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }
} 