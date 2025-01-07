import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger, UnauthorizedException } from '@nestjs/common';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { ClerkGuard } from '../auth/clerk.guard';
import { ChannelsService } from '../channels/channels.service';
import { MessageService } from '../message/message.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL?.split(',')[0],
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SocketGateway.name);
  private readonly clerk = createClerkClient({ 
    secretKey: process.env.CLERK_SECRET_KEY 
  });

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly messageService: MessageService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn('No token provided for socket connection');
        throw new UnauthorizedException('No token provided');
      }

      // Verify the token with Clerk
      const { sub: userId } = await this.clerk.verifyToken(token);
      
      if (!userId) {
        this.logger.warn('Invalid user ID from token');
        throw new UnauthorizedException('Invalid user ID');
      }

      // Store userId in socket data
      client.data.userId = userId;
      
      // Join user's personal room
      client.join(`user:${userId}`);
      
      this.logger.log(`Client connected: ${userId}`);
    } catch (error) {
      this.logger.error('Socket connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    // Leave all rooms
    client.rooms.forEach(room => client.leave(room));
    this.logger.log(`Client disconnected: ${userId}`);
  }

  @SubscribeMessage('message:send')
  async handleMessage(client: Socket, payload: { 
    channelId: string;
    content: string;
    parentId?: string;
  }) {
    const userId = client.data.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const message = await this.messageService.createMessage(
      payload.channelId,
      userId,
      payload
    );

    this.server.to(`channel:${payload.channelId}`).emit('message:new', message);
    return message;
  }

  @SubscribeMessage('channel:join')
  async handleJoinChannel(client: Socket, channelId: string) {
    const userId = client.data.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      const channel = await this.channelsService.findOne(userId, channelId);
      client.join(`channel:${channelId}`);
      this.logger.log(`User ${userId} joined channel ${channelId}`);
      
      // Notify channel members of new join
      this.server.to(`channel:${channelId}`).emit('channel:member_joined', {
        channelId,
        userId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.warn(`User ${userId} attempted to join unauthorized channel ${channelId}`);
      throw error;
    }
  }

  @SubscribeMessage('channel:leave')
  async handleLeaveChannel(client: Socket, channelId: string) {
    const userId = client.data.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    client.leave(`channel:${channelId}`);
    this.logger.log(`User ${userId} left channel ${channelId}`);

    // Notify channel members of leave
    this.server.to(`channel:${channelId}`).emit('channel:member_left', {
      channelId,
      userId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('channel:typing')
  handleTyping(client: Socket, channelId: string) {
    const userId = client.data.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Notify channel members of typing status
    this.server.to(`channel:${channelId}`).emit('channel:typing', {
      channelId,
      userId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('channel:stop_typing')
  handleStopTyping(client: Socket, channelId: string) {
    const userId = client.data.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Notify channel members of stopped typing
    this.server.to(`channel:${channelId}`).emit('channel:stop_typing', {
      channelId,
      userId,
      timestamp: new Date(),
    });
  }
} 