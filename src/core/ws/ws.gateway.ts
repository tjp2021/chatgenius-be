import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventService } from '../events/event.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { Injectable, UseGuards, Logger } from '@nestjs/common';
import { BaseGateway } from './base.gateway';
import { WsGuard } from '../../shared/guards/ws.guard';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL, process.env.FRONTEND_URL?.replace('http', 'ws')],
    credentials: true,
  },
  path: '/api/socket/io',
  transports: ['websocket'],
})
@UseGuards(WsGuard)
export class WsGateway extends BaseGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WsGateway.name);

  constructor(protected readonly eventService: EventService) {
    super(eventService);
  }

  afterInit(server: Server) {
    this.logger.log('WsGateway initialized, setting server in EventService');
    this.eventService.setServer(server);
    this.logger.log('Server successfully set in EventService');
  }

  async handleConnection(client: AuthenticatedSocket) {
    if (!this.validateClient(client)) return;

    const userId = this.getClientUserId(client);

    // Join user's personal room
    client.join(`user:${userId}`);

    // Get user's channels and join their rooms
    const channels = this.eventService.getUserChannels(userId);
    channels.forEach(channelId => {
      client.join(`channel:${channelId}`);
    });
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.getClientUserId(client);
    if (!userId) return;

    // Leave all rooms
    const channels = this.eventService.getUserChannels(userId);
    channels.forEach(channelId => {
      this.eventService.unsubscribe(channelId, client.id, userId);
      client.leave(`channel:${channelId}`);
    });

    client.leave(`user:${userId}`);
  }
} 