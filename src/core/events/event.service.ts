import { Injectable } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventType, EventData } from './event.types';

@Injectable()
export class EventService {
  @WebSocketServer()
  private server: Server;

  private channelSubscriptions: Map<string, Set<string>> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  // Emit an event to all clients in a channel
  emit<T extends EventType>(
    channelId: string,
    event: T,
    data: EventData[T],
  ): void {
    if (!this.channelSubscriptions.has(channelId)) return;
    
    const socketIds = this.channelSubscriptions.get(channelId);
    if (!socketIds) return;

    socketIds.forEach(socketId => {
      this.server.to(socketId).emit(event, data);
    });
  }

  // Subscribe a socket to a channel
  subscribe(channelId: string, socketId: string, userId: string): void {
    // Add to channel subscriptions
    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set());
    }
    this.channelSubscriptions.get(channelId)?.add(socketId);

    // Add to user socket mapping
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);
  }

  // Unsubscribe a socket from a channel
  unsubscribe(channelId: string, socketId: string, userId: string): void {
    // Remove from channel subscriptions
    this.channelSubscriptions.get(channelId)?.delete(socketId);
    if (this.channelSubscriptions.get(channelId)?.size === 0) {
      this.channelSubscriptions.delete(channelId);
    }

    // Remove from user socket mapping
    this.userSockets.get(userId)?.delete(socketId);
    if (this.userSockets.get(userId)?.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  // Emit an event to all sockets of a specific user
  emitToUser<T extends EventType>(
    userId: string,
    event: T,
    data: EventData[T],
  ): void {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) return;

    socketIds.forEach(socketId => {
      this.server.to(socketId).emit(event, data);
    });
  }

  // Get all socket IDs for a user
  getUserSockets(userId: string): Set<string> | undefined {
    return this.userSockets.get(userId);
  }

  // Check if a user is subscribed to a channel
  isSubscribed(channelId: string, userId: string): boolean {
    const userSockets = this.userSockets.get(userId);
    if (!userSockets) return false;

    const channelSockets = this.channelSubscriptions.get(channelId);
    if (!channelSockets) return false;

    return Array.from(userSockets).some(socketId => 
      channelSockets.has(socketId)
    );
  }

  // Get all channels a user is subscribed to
  getUserChannels(userId: string): string[] {
    const userSockets = this.userSockets.get(userId);
    if (!userSockets) return [];

    return Array.from(this.channelSubscriptions.entries())
      .filter(([_, sockets]) => 
        Array.from(userSockets).some(socketId => sockets.has(socketId))
      )
      .map(([channelId]) => channelId);
  }
} 