import { 
  WebSocketGateway, 
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SocketGateway.name);
  
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    // Join user's personal room
    await client.join(`user:${userId}`);
    this.logger.debug(`Client connected: ${userId}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.auth.userId;
    this.logger.debug(`Client disconnected: ${userId}`);
  }

  // Emit to all clients in a channel
  emitToChannel(channelId: string, event: string, data: any) {
    this.server.to(`channel:${channelId}`).emit(event, data);
  }

  // Join a channel room
  async joinChannel(userId: string, channelId: string) {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      await socket.join(`channel:${channelId}`);
    }
  }

  // Leave a channel room
  async leaveChannel(userId: string, channelId: string) {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      await socket.leave(`channel:${channelId}`);
    }
  }
} 