import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const userId = client.handshake.auth.userId;

      if (!userId) {
        return false;
      }

      // Store userId in socket data for later use
      client.data.userId = userId;
      return true;
    } catch (error) {
      return false;
    }
  }
} 