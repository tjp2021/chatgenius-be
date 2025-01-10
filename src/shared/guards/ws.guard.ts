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
      this.logger.debug(`[${timestamp}] 🔍 WsGuard.canActivate called`);
      
      const client = context.switchToWs().getClient<Socket>();
      this.logger.debug(`[${timestamp}] 📡 Socket client:`, { 
        id: client.id,
        handshake: {
          auth: client.handshake.auth,
          query: client.handshake.query,
          headers: client.handshake.headers
        }
      });

      const token = client.handshake.auth.token;
      this.logger.debug(`[${timestamp}] 🎟️ Auth token received:`, { 
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'NO_TOKEN'
      });
      
      if (!token) {
        this.logger.error(`[${timestamp}] ❌ No token provided in socket handshake`);
        return false;
      }

      this.logger.debug(`[${timestamp}] 🔐 Attempting to verify token with Clerk...`);
      
      // Verify the JWT token with Clerk
      const verifyResult = await clerkClient.verifyToken(token);
      this.logger.debug(`[${timestamp}] ✅ Token verification result:`, {
        hasSubject: !!verifyResult.sub,
        subject: verifyResult.sub,
        sessionId: verifyResult.sid,
        fullResult: verifyResult
      });
      
      if (!verifyResult.sub) {
        this.logger.error(`[${timestamp}] ❌ Invalid token or no sub (userId) in verified token`);
        return false;
      }

      const socket = client as AuthenticatedSocket;
      socket.userId = verifyResult.sub;
      socket.user = { id: verifyResult.sub };
      
      this.logger.debug(`[${timestamp}] 🔓 Socket authenticated successfully`, { 
        userId: verifyResult.sub,
        socketId: socket.id,
        handshakeAuth: socket.handshake.auth,
        userDataSet: {
          hasUserId: !!socket.userId,
          hasUserObject: !!socket.user,
          userIdMatch: socket.userId === socket.user?.id
        }
      });

      return true;
    } catch (error) {
      this.logger.error(`[${timestamp}] 💥 Socket authentication failed:`, {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      });
      return false;
    }
  }
}