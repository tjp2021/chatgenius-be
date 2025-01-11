import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthenticatedSocket } from '../types/ws.types';
import { clerkClient } from '@clerk/clerk-sdk-node';

@Injectable()
export class WsGuard implements CanActivate {
  private readonly logger = new Logger(WsGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const timestamp = new Date().toISOString();
    try {
      this.logger.debug(`[${timestamp}] 🔍 WsGuard.canActivate called for ${context.getClass().name}`);
      
      const client = context.switchToWs().getClient<Socket>();
      this.logger.debug(`[${timestamp}] 📡 Socket client connected:`, { 
        id: client.id,
        auth: client.handshake.auth?.token ? 'present' : 'missing',
        headers: {
          authorization: client.handshake.headers?.authorization ? 'present' : 'missing'
        }
      });

      // Try to get token from different sources
      const authToken = client.handshake.auth?.token;
      const headerToken = client.handshake.headers?.authorization?.replace('Bearer ', '');
      const queryToken = client.handshake.query?.token;
      
      const token = authToken || headerToken || queryToken;
      
      if (!token) {
        this.logger.error(`[${timestamp}] ❌ No token provided in socket handshake`);
        return false;
      }

      try {
        // Verify the JWT token with Clerk
        const verifyResult = await clerkClient.verifyToken(token);
        
        if (!verifyResult.sub) {
          this.logger.error(`[${timestamp}] ❌ Invalid token or no sub (userId) in verified token`);
          return false;
        }

        const socket = client as AuthenticatedSocket;
        socket.userId = verifyResult.sub;
        socket.user = { id: verifyResult.sub };
        
        this.logger.debug(`[${timestamp}] 🔓 Socket authenticated:`, { 
          userId: verifyResult.sub,
          socketId: socket.id
        });

        return true;
      } catch (verifyError) {
        this.logger.error(`[${timestamp}] ❌ Token verification failed:`, {
          error: verifyError.message,
          code: verifyError.code
        });
        return false;
      }
    } catch (error) {
      this.logger.error(`[${timestamp}] 💥 Socket authentication failed:`, {
        error: error.message,
        context: context.getClass().name
      });
      return false;
    }
  }
}