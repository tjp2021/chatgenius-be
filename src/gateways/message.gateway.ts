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
import { TypingIndicatorDto } from '../message/dto/typing-indicator.dto';
import { MessageDeliveryDto } from '../message/dto/message-delivery.dto';
import { MessageDeliveryStatus } from '../message/dto/message-events.enum';

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
  ) {}

  @SubscribeMessage(MessageEvent.SEND)
  async handleMessageSend(client: Socket, payload: MessageEventDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      // Create message with pending status
      const message = await this.messageService.create(userId, {
        ...payload,
        deliveryStatus: MessageDeliveryStatus.SENT
      });

      // Broadcast to channel room
      this.server.to(`channel:${payload.channelId}`).emit(MessageEvent.NEW, message);
      
      // Confirm to sender
      client.emit(MessageEvent.SENT, {
        messageId: message.id,
        channelId: message.channelId,
        status: MessageDeliveryStatus.SENT
      });

      return message;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      client.emit(MessageEvent.ERROR, { error: error.message });
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage(MessageEvent.TYPING_START)
  async handleTypingStart(client: Socket, payload: TypingIndicatorDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      this.server.to(`channel:${payload.channelId}`).emit(MessageEvent.TYPING_START, {
        userId,
        channelId: payload.channelId,
        isTyping: true
      });
    } catch (error) {
      this.logger.error(`Error handling typing indicator: ${error.message}`, error.stack);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage(MessageEvent.TYPING_STOP)
  async handleTypingStop(client: Socket, payload: TypingIndicatorDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      this.server.to(`channel:${payload.channelId}`).emit(MessageEvent.TYPING_STOP, {
        userId,
        channelId: payload.channelId,
        isTyping: false
      });
    } catch (error) {
      this.logger.error(`Error handling typing indicator: ${error.message}`, error.stack);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage(MessageEvent.DELIVERED)
  async handleMessageDelivered(client: Socket, payload: MessageDeliveryDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      // Update message delivery status
      await this.messageService.updateDeliveryStatus(
        payload.messageId,
        MessageDeliveryStatus.DELIVERED
      );

      // Notify sender of delivery
      this.server.to(`user:${userId}`).emit(MessageEvent.DELIVERED, payload);
    } catch (error) {
      this.logger.error(`Error handling message delivery: ${error.message}`, error.stack);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage(MessageEvent.READ)
  async handleMessageRead(client: Socket, payload: MessageDeliveryDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      // Update message read status
      await this.messageService.updateDeliveryStatus(
        payload.messageId,
        MessageDeliveryStatus.READ
      );

      // Notify sender that message was read
      this.server.to(`user:${userId}`).emit(MessageEvent.READ, payload);
    } catch (error) {
      this.logger.error(`Error handling message read status: ${error.message}`, error.stack);
      throw new WsException(error.message);
    }
  }
} 