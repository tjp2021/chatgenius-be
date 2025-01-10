import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class EventService {
  private server: Server;
  private readonly logger = new Logger(EventService.name);
  private subscriptions: Map<string, Set<string>> = new Map(); // channelId -> Set of clientIds
  private userChannels: Map<string, Set<string>> = new Map(); // userId -> Set of channelIds
  private isInitialized = false;

  setServer(server: Server) {
    this.server = server;
    this.isInitialized = true;
    this.logger.log('🚀 Socket server initialized in EventService');
  }

  private ensureServer() {
    if (!this.server || !this.isInitialized) {
      this.logger.error('❌ Socket server not initialized', {
        hasServer: !!this.server,
        isInitialized: this.isInitialized,
        subscriptionCount: this.subscriptions.size,
        userChannelCount: this.userChannels.size
      });
      throw new Error('Socket server not initialized');
    }
  }

  // Core emit methods
  emit(channelId: string, event: string, data: any) {
    this.ensureServer();
    try {
      this.logger.debug(`🔄 Emitting event to channel ${channelId}`, {
        event,
        channelId,
        hasSubscribers: this.subscriptions.has(channelId),
        subscriberCount: this.subscriptions.get(channelId)?.size || 0
      });
      this.server.to(`channel:${channelId}`).emit(event, data);
    } catch (error) {
      this.logger.error(`❌ Error emitting event ${event} to channel ${channelId}:`, error);
      throw error;
    }
  }

  emitToChannel(channelId: string, event: string, data: any) {
    this.ensureServer();
    try {
      this.server.to(`channel:${channelId}`).emit(event, data);
    } catch (error) {
      this.logger.error(`Error emitting event ${event} to channel ${channelId}:`, error);
      throw error;
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    this.ensureServer();
    try {
      this.server.to(`user:${userId}`).emit(event, data);
    } catch (error) {
      this.logger.error(`Error emitting event ${event} to user ${userId}:`, error);
      throw error;
    }
  }

  emitToAll(event: string, data: any) {
    this.ensureServer();
    try {
      this.server.emit(event, data);
    } catch (error) {
      this.logger.error(`Error broadcasting event ${event}:`, error);
      throw error;
    }
  }

  // Subscription management
  subscribe(channelId: string, clientId: string, userId: string) {
    this.logger.debug(`➕ Subscribing client to channel`, {
      channelId,
      clientId,
      userId,
      currentSubscribers: Array.from(this.subscriptions.get(channelId) || []),
      userCurrentChannels: Array.from(this.userChannels.get(userId) || [])
    });
    
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

    this.logger.debug(`✅ Subscription complete`, {
      channelId,
      clientId,
      userId,
      newSubscriberCount: this.subscriptions.get(channelId)?.size,
      newUserChannelCount: this.userChannels.get(userId)?.size
    });
  }

  unsubscribe(channelId: string, clientId: string, userId: string) {
    this.logger.debug(`➖ Unsubscribing client from channel`, {
      channelId,
      clientId,
      userId,
      hadSubscription: this.subscriptions.get(channelId)?.has(clientId),
      hadChannel: this.userChannels.get(userId)?.has(channelId)
    });
    
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

    this.logger.debug(`✅ Unsubscribe complete`, {
      channelId,
      remainingSubscribers: this.subscriptions.get(channelId)?.size || 0,
      remainingUserChannels: this.userChannels.get(userId)?.size || 0
    });
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