import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WsGuard } from '../../shared/guards/ws.guard';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { EventService } from '../events/event.service';
import { EventType, EventData } from '../events/event.types';

@NestWebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
@UseGuards(WsGuard)
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(private readonly eventService: EventService) {}

  @WebSocketServer()
  server: Server;

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client connected: ${client.id} (User: ${client.userId})`);
      
      // Emit presence online event
      this.eventService.emitToUser(client.userId, 'presence.online', {
        userId: client.userId,
        status: 'online',
        lastSeen: new Date(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client disconnected: ${client.id} (User: ${client.userId})`);
      
      // Get all channels the user was subscribed to
      const channels = this.eventService.getUserChannels(client.userId);
      
      // Unsubscribe from all channels
      channels.forEach(channelId => {
        this.eventService.unsubscribe(channelId, client.id, client.userId);
      });

      // Emit presence offline event
      this.eventService.emitToUser(client.userId, 'presence.offline', {
        userId: client.userId,
        status: 'offline',
        lastSeen: new Date(),
      });
    } catch (error) {
      this.logger.error(`Disconnection error: ${error.message}`, error.stack);
    }
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      const { channelId } = data;
      this.eventService.subscribe(channelId, client.id, client.userId);
      
      this.logger.log(`User ${client.userId} joined channel ${channelId}`);
      
      // Emit channel joined event
      this.eventService.emit(channelId, 'channel.member_joined', {
        channelId,
        member: {
          userId: client.userId,
          channelId,
          role: 'MEMBER',
          joinedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Join channel error: ${error.message}`, error.stack);
      throw error;
    }
  }

  @SubscribeMessage('leave_channel')
  async handleLeaveChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      const { channelId } = data;
      this.eventService.unsubscribe(channelId, client.id, client.userId);
      
      this.logger.log(`User ${client.userId} left channel ${channelId}`);
      
      // Emit channel left event
      this.eventService.emit(channelId, 'channel.member_left', {
        channelId,
        userId: client.userId,
      });
    } catch (error) {
      this.logger.error(`Leave channel error: ${error.message}`, error.stack);
      throw error;
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      const { channelId } = data;
      
      if (!this.eventService.isSubscribed(channelId, client.userId)) {
        throw new Error('User not subscribed to channel');
      }
      
      this.eventService.emit(channelId, 'channel.typing', {
        userId: client.userId,
        channelId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Typing event error: ${error.message}`, error.stack);
      throw error;
    }
  }
} 