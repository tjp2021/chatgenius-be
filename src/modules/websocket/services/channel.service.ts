import { Injectable, Logger } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { Server } from 'socket.io';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(private readonly websocketService: WebsocketService) {}

  async handleChannelJoin(server: Server, userId: string, channelId: string) {
    const socket = this.websocketService.getUserSocket(userId);
    if (!socket) {
      this.logger.warn(`No socket found for user ${userId}`);
      return;
    }

    await socket.join(`channel:${channelId}`);
    
    // Broadcast to channel members
    server.to(`channel:${channelId}`).emit('channel:user_joined', {
      userId,
      channelId,
      timestamp: new Date(),
    });
  }

  async handleChannelLeave(server: Server, userId: string, channelId: string) {
    const socket = this.websocketService.getUserSocket(userId);
    if (!socket) return;

    await socket.leave(`channel:${channelId}`);
    
    // Broadcast to remaining members
    server.to(`channel:${channelId}`).emit('channel:user_left', {
      userId,
      channelId,
      timestamp: new Date(),
    });
  }

  async syncUserChannels(userId: string, channels: string[]) {
    const socket = this.websocketService.getUserSocket(userId);
    if (!socket) return;

    // Get current rooms
    const currentRooms = Array.from(socket.rooms)
      .filter(room => room.startsWith('channel:'))
      .map(room => room.replace('channel:', ''));

    // Leave channels user no longer has access to
    const channelsToLeave = currentRooms.filter(
      room => !channels.includes(room)
    );
    
    // Join new channels
    const channelsToJoin = channels.filter(
      channel => !currentRooms.includes(channel)
    );

    // Execute room changes
    await Promise.all([
      ...channelsToLeave.map(channel => 
        socket.leave(`channel:${channel}`)
      ),
      ...channelsToJoin.map(channel => 
        socket.join(`channel:${channel}`)
      )
    ]);
  }
} 