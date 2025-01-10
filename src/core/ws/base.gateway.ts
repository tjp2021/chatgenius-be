import { WebSocketGateway as NestGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventService } from '../events/event.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { Logger } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';

@NestGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
  transports: ['websocket'],
})
export class BaseGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  protected server: Server;
  private readonly logger = new Logger(BaseGateway.name);

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
      this.logger.debug(`[${timestamp}] 🔌 Authenticating client`, {
        id: client.id,
        handshakeAuth: client.handshake.auth
      });

      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.error(`[${timestamp}] ❌ No token provided`);
        return false;
      }

      this.logger.debug(`[${timestamp}] 🔐 Verifying token...`);
      const verifyResult = await clerkClient.verifyToken(token);
      
      if (!verifyResult.sub) {
        this.logger.error(`[${timestamp}] ❌ Invalid token - no sub claim`);
        return false;
      }

      // Set the userId directly on the socket
      client.userId = verifyResult.sub;
      client.user = { id: verifyResult.sub };

      this.logger.debug(`[${timestamp}] ✅ Client authenticated successfully`, {
        socketId: client.id,
        userId: client.userId
      });

      return true;
    } catch (error) {
      this.logger.error(`[${timestamp}] 💥 Authentication failed:`, {
        error: error.message,
        stack: error.stack
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
      handshakeAuth: client.handshake.auth
    });

    // First authenticate
    const isAuthenticated = await this.authenticateClient(client);
    if (!isAuthenticated) {
      this.logger.error(`[${timestamp}] ❌ Authentication failed`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
      return;
    }

    // Then validate the authenticated socket
    if (!this.validateClient(client)) {
      this.logger.error(`[${timestamp}] ❌ Validation failed`);
      client.emit('error', { message: 'Validation failed' });
      client.disconnect();
      return;
    }

    this.logger.debug(`[${timestamp}] ✅ Client connected and authenticated`, {
      id: client.id,
      userId: client.userId
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