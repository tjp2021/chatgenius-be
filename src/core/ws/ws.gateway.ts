import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventService } from '../events/event.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { Injectable, UseGuards } from '@nestjs/common';
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
  constructor(protected readonly eventService: EventService) {
    super(eventService);
  }

  afterInit(server: Server) {
    this.logger.log('🚀 WsGateway initializing...', {
      hasServer: !!server,
      serverPath: server?.path(),
      engineOptions: server?.engine?.opts
    });

    try {
      this.eventService.setServer(server);
      this.logger.log('✅ Server successfully set in EventService');

      // Listen for server-wide events
      server.on('connection_error', (err) => {
        this.logger.error('❌ Connection error:', err);
      });

      server.on('new_namespace', (namespace) => {
        this.logger.log('🔌 New namespace created:', namespace.name);
      });

    } catch (error) {
      this.logger.error('❌ Failed to initialize WsGateway:', error);
      throw error;
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    const timestamp = new Date().toISOString();
    this.logger.debug(`[${timestamp}] 🔌 New connection attempt`, {
      clientId: client.id,
      handshake: {
        auth: client.handshake.auth,
        query: client.handshake.query,
        headers: client.handshake.headers
      }
    });

    if (!this.validateClient(client)) {
      this.logger.error(`[${timestamp}] ❌ Client validation failed`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
      return;
    }

    const userId = this.getClientUserId(client);
    this.logger.debug(`[${timestamp}] ✅ Client authenticated`, { userId });

    // Notify client that we're starting room joins
    client.emit('connection:starting', { userId });

    try {
      // Join user's personal room
      await client.join(`user:${userId}`);
      this.logger.debug(`[${timestamp}] 👤 Joined personal room`, { room: `user:${userId}` });

      // Get user's channels and join their rooms
      const channels = this.eventService.getUserChannels(userId);
      this.logger.debug(`[${timestamp}] 📋 User channels`, { channels });

      // Join all channels sequentially to ensure order
      for (const channelId of channels) {
        await client.join(`channel:${channelId}`);
        this.eventService.subscribe(channelId, client.id, userId);
        this.logger.debug(`[${timestamp}] 🔗 Joined channel room`, { 
          channelId,
          room: `channel:${channelId}`
        });
      }

      // Notify client that all rooms are joined and ready
      client.emit('connection:ready', {
        userId,
        channels,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error(`[${timestamp}] ❌ Error during room setup:`, error);
      client.emit('connection:error', { 
        message: 'Failed to setup rooms',
        error: error.message
      });
      client.disconnect();
      return;
    }

    // Monitor socket events
    client.onAny((event, ...args) => {
      this.logger.debug(`[${timestamp}] 📡 Socket event`, { 
        event, 
        args,
        clientId: client.id,
        userId
      });
    });
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const timestamp = new Date().toISOString();
    const userId = this.getClientUserId(client);
    
    if (!userId) {
      this.logger.debug(`[${timestamp}] ⚠️ Unauthenticated client disconnected`, { 
        clientId: client.id 
      });
      return;
    }

    this.logger.debug(`[${timestamp}] 🔌 Client disconnecting`, {
      clientId: client.id,
      userId,
      reason: client.disconnected
    });

    try {
      // Leave all rooms
      const channels = this.eventService.getUserChannels(userId);
      for (const channelId of channels) {
        this.eventService.unsubscribe(channelId, client.id, userId);
        await client.leave(`channel:${channelId}`);
        this.logger.debug(`[${timestamp}] 🚪 Left channel room`, { 
          channelId,
          room: `channel:${channelId}`
        });
      }

      await client.leave(`user:${userId}`);
      this.logger.debug(`[${timestamp}] 👋 Left personal room`, { 
        room: `user:${userId}` 
      });
    } catch (error) {
      this.logger.error(`[${timestamp}] ❌ Error during disconnect cleanup:`, error);
    }
  }
} 