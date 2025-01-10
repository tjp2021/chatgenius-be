import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { AuthenticatedSocket } from '../types/ws.types';

@Injectable()
export class WsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const token = client.handshake.auth.token;
      
      if (!token) {
        return false;
      }

      const decoded = verify(token, process.env.JWT_SECRET) as { sub: string };
      const socket = client as AuthenticatedSocket;
      socket.userId = decoded.sub;
      socket.user = { id: decoded.sub };
      
      return true;
    } catch {
      return false;
    }
  }
}