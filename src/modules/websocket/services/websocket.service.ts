import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WebsocketService {
  private userSockets: Map<string, Socket> = new Map();

  setUserSocket(userId: string, socket: Socket) {
    this.userSockets.set(userId, socket);
  }

  removeUserSocket(userId: string) {
    this.userSockets.delete(userId);
  }

  getUserSocket(userId: string): Socket | undefined {
    return this.userSockets.get(userId);
  }

  getActiveConnections(): number {
    return this.userSockets.size;
  }
} 