import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { User } from '../interfaces/websocket.interfaces';

@Injectable()
export class WebsocketService {
  private userSockets: Map<string, Socket> = new Map();
  private connectedUsers: Map<string, User> = new Map();

  setUserSocket(userId: string, socket: Socket, userData: User) {
    this.userSockets.set(userId, socket);
    this.connectedUsers.set(userId, userData);
  }

  removeUserSocket(userId: string) {
    this.userSockets.delete(userId);
    this.connectedUsers.delete(userId);
  }

  getUserSocket(userId: string): Socket | undefined {
    return this.userSockets.get(userId);
  }

  getUserData(userId: string): User | undefined {
    return this.connectedUsers.get(userId);
  }

  updateUserData(userId: string, userData: Partial<User>) {
    const existingData = this.connectedUsers.get(userId);
    if (existingData) {
      this.connectedUsers.set(userId, { ...existingData, ...userData });
    }
  }

  getActiveConnections(): number {
    return this.userSockets.size;
  }

  getAllConnectedUsers(): User[] {
    return Array.from(this.connectedUsers.values());
  }
} 