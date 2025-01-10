import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class EventService {
  private server: Server;
  private subscriptions: Map<string, Set<string>> = new Map(); // channelId -> Set of clientIds
  private userChannels: Map<string, Set<string>> = new Map(); // userId -> Set of channelIds

  setServer(server: Server) {
    this.server = server;
  }

  // Core emit methods
  emit(channelId: string, event: string, data: any) {
    this.server.to(`channel:${channelId}`).emit(event, data);
  }

  emitToChannel(channelId: string, event: string, data: any) {
    this.server.to(`channel:${channelId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // Subscription management
  subscribe(channelId: string, clientId: string, userId: string) {
    // Add to channel subscriptions
    if (!this.subscriptions.has(channelId)) {
      this.subscriptions.set(channelId, new Set());
    }
    this.subscriptions.get(channelId)!.add(clientId);

    // Add to user's channel list
    if (!this.userChannels.has(userId)) {
      this.userChannels.set(userId, new Set());
    }
    this.userChannels.get(userId)!.add(channelId);
  }

  unsubscribe(channelId: string, clientId: string, userId: string) {
    // Remove from channel subscriptions
    const channelSubs = this.subscriptions.get(channelId);
    if (channelSubs) {
      channelSubs.delete(clientId);
      if (channelSubs.size === 0) {
        this.subscriptions.delete(channelId);
      }
    }

    // Remove from user's channel list
    const userChans = this.userChannels.get(userId);
    if (userChans) {
      userChans.delete(channelId);
      if (userChans.size === 0) {
        this.userChannels.delete(userId);
      }
    }
  }

  isSubscribed(channelId: string, userId: string): boolean {
    const userChans = this.userChannels.get(userId);
    return userChans ? userChans.has(channelId) : false;
  }

  getUserChannels(userId: string): string[] {
    const channels = this.userChannels.get(userId);
    return channels ? Array.from(channels) : [];
  }

  // Legacy support - these will be deprecated
  broadcastToUser(userId: string, event: string, data: any) {
    this.emitToUser(userId, event, data);
  }

  broadcastToChannel(channelId: string, event: string, data: any) {
    this.emitToChannel(channelId, event, data);
  }

  broadcastToAll(event: string, data: any) {
    this.emitToAll(event, data);
  }
} 