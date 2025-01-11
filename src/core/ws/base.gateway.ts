import { WebSocketGateway as NestGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventService } from '../events/event.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { WsGuard } from '../../shared/guards/ws.guard';

@Injectable()
@UseGuards(WsGuard)
@NestGateway({
  cors: {
    origin: [process.env.FRONTEND_URL, process.env.FRONTEND_URL?.replace('http', 'ws')],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
  transports: ['websocket'],
  path: '/api/socket/io'
})
export class BaseGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  protected server: Server;
  protected readonly logger = new Logger(BaseGateway.name);

  constructor(protected readonly eventService: EventService) {}

  protected success<T>(data: T) {
    return {
      success: true,
      data,
    };
  }

  protected error(message: string) {
    return {
      success: false,
      error: message,
    };
  }

  protected async authenticateClient(client: AuthenticatedSocket): Promise<boolean> {
    const timestamp = new Date().toISOString();
    try {
      this.logger.debug(`[${timestamp}] 🔌 Authentication attempt`, {
        clientId: client.id,
        ipAddress: client.handshake.address,
        userAgent: client.handshake.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      // Try to get token from different sources
      const token = 
        client.handshake.auth?.token || 
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`[${timestamp}] ❌ Authentication failed: No token provided`, {
          clientId: client.id,
          ipAddress: client.handshake.address,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      this.logger.debug(`[${timestamp}] 🔐 Verifying token...`);
      const verifyResult = await clerkClient.verifyToken(token);
      
      if (!verifyResult.sub) {
        this.logger.warn(`[${timestamp}] ❌ Authentication failed: Invalid token`, {
          clientId: client.id,
          ipAddress: client.handshake.address,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      // Set the userId directly on the socket
      client.userId = verifyResult.sub;
      client.user = { id: verifyResult.sub };

      this.logger.log(`[${timestamp}] ✅ Authentication successful`, {
        clientId: client.id,
        userId: client.userId,
        ipAddress: client.handshake.address,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      this.logger.error(`[${timestamp}] 💥 Authentication error`, {
        clientId: client.id,
        ipAddress: client.handshake.address,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  protected getClientUserId(client: AuthenticatedSocket): string {
    if (!client.userId) {
      return null;
    }
    return client.userId;
  }

  protected validateClient(client: AuthenticatedSocket): boolean {
    const userId = this.getClientUserId(client);
    if (!userId) {
      return false;
    }
    return true;
  }

  async handleConnection(client: AuthenticatedSocket) {
    const timestamp = new Date().toISOString();
    this.logger.debug(`[${timestamp}] 🔌 New client connection`, {
      id: client.id,
      handshakeAuth: client.handshake.auth,
      userId: client.userId,
      user: client.user,
      headers: client.handshake.headers,
      query: client.handshake.query
    });

    // Check if WsGuard has already authenticated the client
    if (client.userId && client.user?.id) {
      this.logger.debug(`[${timestamp}] ✅ Client pre-authenticated by WsGuard`, {
        id: client.id,
        userId: client.userId
      });
    } else {
      // Fallback to our own authentication
      const isAuthenticated = await this.authenticateClient(client);
      if (!isAuthenticated) {
        this.logger.error(`[${timestamp}] ❌ Authentication failed`);
        client.emit('error', { message: 'Authentication failed' });
        client.disconnect();
        return;
      }
    }

    // Then validate the authenticated socket
    if (!this.validateClient(client)) {
      this.logger.error(`[${timestamp}] ❌ Validation failed`, {
        hasUserId: !!client.userId,
        userId: client.userId,
        hasUser: !!client.user,
        userObject: client.user
      });
      client.emit('error', { message: 'Validation failed' });
      client.disconnect();
      return;
    }

    this.logger.debug(`[${timestamp}] ✅ Client connected and authenticated`, {
      id: client.id,
      userId: client.userId,
      userObject: client.user
    });
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const timestamp = new Date().toISOString();
    this.logger.debug(`[${timestamp}] 🔌 Client disconnected`, {
      id: client.id,
      userId: client.userId,
      reason: client.disconnected
    });
  }
} 