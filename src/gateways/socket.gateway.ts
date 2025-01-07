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
  private onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socket ids

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly messageService: MessageService,
  ) {}

  private updateUserPresence(userId: string, isOnline: boolean) {
    // Broadcast to all clients
    this.server.emit('presence:update', { userId, isOnline });
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn('Socket connection: No token provided', {
          clientId: client.id,
          handshake: client.handshake,
        });
        throw new UnauthorizedException('No token provided');
      }

      // Verify the token with Clerk
      const { sub: userId } = await this.clerk.verifyToken(token);
      
      if (!userId) {
        this.logger.warn('Socket connection: Invalid user ID from token', {
          clientId: client.id,
          token: token.substring(0, 10) + '...',
        });
        throw new UnauthorizedException('Invalid user ID');
      }

      // Store userId in socket data
      client.data.userId = userId;
      
      // Update online status
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(client.id);
      
      // If this is the first socket for this user, broadcast presence
      if (this.onlineUsers.get(userId)!.size === 1) {
        this.updateUserPresence(userId, true);
      }
      
      // Join user's personal room
      client.join(`user:${userId}`);
      
      this.logger.log('Socket connection: Client connected successfully', {
        clientId: client.id,
        userId,
        rooms: Array.from(client.rooms),
      });
    } catch (error) {
      this.logger.error('Socket connection: Error during connection', {
        clientId: client.id,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
      });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    // Update online status
    const userSockets = this.onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);
      // If this was the last socket for this user, broadcast offline status
      if (userSockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.updateUserPresence(userId, false);
      }
    }

    // Leave all rooms
    client.rooms.forEach(room => client.leave(room));
    this.logger.log('Socket disconnected:', {
      userId,
      remainingSockets: userSockets?.size || 0,
    });
  }

  @SubscribeMessage('message:send')
  async handleMessage(client: Socket, payload: { 
    channelId: string;
    content: string;
    parentId?: string;
  }) {
    const userId = client.data.userId;
    if (!userId) {
      this.logger.warn('Message send: No user ID in socket data', {
        clientId: client.id,
        payload,
      });
      throw new UnauthorizedException('User not authenticated');
    }

    this.logger.log('Message send: Attempting to create message', {
      clientId: client.id,
      userId,
      channelId: payload.channelId,
      hasParent: !!payload.parentId,
    });

    try {
      const message = await this.messageService.createMessage(
        payload.channelId,
        userId,
        payload
      );

      this.logger.log('Message send: Message created successfully', {
        messageId: message.id,
        channelId: payload.channelId,
        userId,
      });

      // Emit to all clients in the channel
      this.server.to(`channel:${payload.channelId}`).emit('message:new', message);
      
      this.logger.log('Message send: Broadcasted to channel', {
        messageId: message.id,
        channelId: payload.channelId,
        room: `channel:${payload.channelId}`,
      });

      return message;
    } catch (error) {
      this.logger.error('Message send: Failed to create/broadcast message', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        payload,
        userId,
      });
      throw error;
    }
  }

  @SubscribeMessage('channel:join')
  async handleJoinChannel(client: Socket, channelId: string) {
    const userId = client.data.userId;
    if (!userId) {
      this.logger.warn('Channel join: No user ID in socket data', {
        clientId: client.id,
        channelId,
      });
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      this.logger.log('Channel join: Attempting to join channel', {
        clientId: client.id,
        userId,
        channelId,
      });

      const channel = await this.channelsService.findOne(userId, channelId);
      client.join(`channel:${channelId}`);
      
      this.logger.log('Channel join: Successfully joined channel', {
        clientId: client.id,
        userId,
        channelId,
        rooms: Array.from(client.rooms),
      });
      
      // Notify channel members of new join
      this.server.to(`channel:${channelId}`).emit('channel:member_joined', {
        channelId,
        userId,
        timestamp: new Date(),
      });

      this.logger.log('Channel join: Broadcasted join event', {
        channelId,
        userId,
      });
    } catch (error) {
      this.logger.error('Channel join: Failed to join channel', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        channelId,
        userId,
      });
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

  @SubscribeMessage('presence:get_online_users')
  handleGetOnlineUsers() {
    const onlineStatus: Record<string, boolean> = {};
    for (const [userId, sockets] of this.onlineUsers.entries()) {
      onlineStatus[userId] = sockets.size > 0;
    }
    return onlineStatus;
  }
} 