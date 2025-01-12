import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const { token, userId } = client.handshake.auth;

      if (!token || !userId) {
        throw new WsException('Missing authentication credentials');
      }

      // Verify with Clerk
      try {
        const jwt = await clerkClient.verifyToken(token);
        if (jwt.sub !== userId) {
          throw new WsException('Invalid user ID');
        }
      } catch (error) {
        throw new WsException('Invalid token');
      }

      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Unauthorized');
    }
  }
} 