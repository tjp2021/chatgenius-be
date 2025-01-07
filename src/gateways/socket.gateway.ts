import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL!, process.env.SOCKET_URL!],
    credentials: true
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    // Join user's room
    client.join(`user:${userId}`);

    // Update online status
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true },
    });

    // Notify others
    this.server.emit('presence:update', { userId, isOnline: true });
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    // Update online status
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false },
    });

    // Notify others
    this.server.emit('presence:update', { userId, isOnline: false });
  }

  // Channel events
  async emitChannelUpdate(channelId: string) {
    this.server.emit('channel:update', channelId);
  }

  async emitMemberCountUpdate(channelId: string) {
    const count = await this.prisma.channelMember.count({
      where: { channelId }
    });
    this.server.emit('channel:member_count', { channelId, count });
  }

  @SubscribeMessage('channel:join')
  async handleChannelJoin(client: Socket, channelId: string) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    client.join(`channel:${channelId}`);
    await this.emitMemberCountUpdate(channelId);
  }

  @SubscribeMessage('channel:leave')
  async handleChannelLeave(client: Socket, channelId: string) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    client.leave(`channel:${channelId}`);
    await this.emitMemberCountUpdate(channelId);
  }
}