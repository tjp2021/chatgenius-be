import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { UseGuards } from '@nestjs/common';
import { ClerkGuard } from '../auth/clerk.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    // Join user's personal room
    client.join(`user:${userId}`);
    
    // Update user presence
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true },
    });

    // Broadcast user online status
    this.server.emit('presence:update', { userId, isOnline: true });
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    // Update user presence
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false },
    });

    // Broadcast user offline status
    this.server.emit('presence:update', { userId, isOnline: false });
  }

  @SubscribeMessage('message:send')
  async handleMessage(client: Socket, payload: { 
    channelId: string;
    content: string;
    parentId?: string;
  }) {
    const userId = client.handshake.auth.userId;

    // Create message using existing service
    const message = await this.prisma.message.create({
      data: {
        content: payload.content,
        channelId: payload.channelId,
        userId,
        parentId: payload.parentId,
      },
      include: {
        user: true,
      },
    });

    // Broadcast to channel
    this.server.to(`channel:${payload.channelId}`).emit('message:new', message);

    return message;
  }

  @SubscribeMessage('channel:join')
  async handleJoinChannel(client: Socket, channelId: string) {
    const userId = client.handshake.auth.userId;

    // Verify channel membership
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (member) {
      client.join(`channel:${channelId}`);
    }
  }

  @SubscribeMessage('channel:leave')
  handleLeaveChannel(client: Socket, channelId: string) {
    client.leave(`channel:${channelId}`);
  }
} 