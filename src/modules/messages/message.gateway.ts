import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { MessageEvent } from './dto/message-events.enum';
import { MessageService } from './message.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://localhost:3000'],
    credentials: true
  }
})
export class MessageGateway implements OnGatewayInit {
  private readonly logger = new Logger(MessageGateway.name);

  constructor(private readonly messageService: MessageService) {}

  afterInit(server: Server) {
    server.use((socket: Socket, next) => {
      try {
        const { token, userId } = socket.handshake.auth;
        
        if (!token || !userId) {
          return next(new Error('Authentication failed - missing credentials'));
        }

        // Store in socket data for future use
        socket.data.userId = userId;
        socket.data.token = token;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  @SubscribeMessage(MessageEvent.SEND)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string; content: string }
  ) {
    this.logger.log(`Received message:send event from client ${client.id}:`, data);
    
    try {
      // Get user ID from socket
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Create message
      const message = await this.messageService.create(userId, {
        channelId: data.channelId,
        content: data.content
      });

      this.logger.log(`Message created successfully:`, { messageId: message.id });

      // Emit to channel room
      client.to(data.channelId).emit(MessageEvent.NEW, message);
      
      // Send confirmation to sender
      client.emit(MessageEvent.SENT, message);

      return { success: true, data: message };
    } catch (error) {
      this.logger.error(`Error handling message:send event:`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(MessageEvent.DELIVERED)
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string }
  ) {
    this.logger.log(`Received message:delivered event:`, data);
    
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await this.messageService.markAsDelivered(data.messageId, userId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling message:delivered event:`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(MessageEvent.READ)
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string }
  ) {
    this.logger.log(`Received message:read event:`, data);
    
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await this.messageService.markAsSeen(data.messageId, userId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling message:read event:`, error.stack);
      return { success: false, error: error.message };
    }
  }
} 