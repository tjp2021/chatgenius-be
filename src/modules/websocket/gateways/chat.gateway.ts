import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException
} from '@nestjs/websockets';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ChannelsService } from '../../channels/services/channels.service';
import { WebsocketService } from '../services/websocket.service';
import { UsersService } from '../../users/services/users.service';
import { MessagesService } from '../../messages/services/messages.service';
import {
  WsResponse,
  Channel,
  Message,
  User,
  ChannelCreatePayload,
  ChannelUpdatePayload,
  ChannelJoinPayload,
  ChannelLeavePayload,
  ChannelMemberRolePayload,
  MessageSendPayload,
  MessageStatusPayload,
  MessageTypingPayload
} from '../interfaces/websocket.interfaces';

// Room cleanup configuration
const ROOM_CLEANUP_CONFIG = {
  INACTIVE_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours
  EMPTY_ROOM_TIMEOUT_MS: 30 * 60 * 1000,    // 30 minutes
  CLEANUP_INTERVAL_MS: 15 * 60 * 1000       // 15 minutes
} as const;

// Room management helper class
interface RoomMetadata {
  createdAt: Date;
  lastActivity: Date;
  memberCount: number;
  activeMembers: Map<string, {
    joinedAt: Date;
    user: User;
  }>;
  lastMessage?: {
    id: string;
    content: string;
    userId: string;
    timestamp: Date;
  };
  typingUsers: Map<string, {
    user: User;
    startedAt: Date;
  }>;
}

class RoomManager {
  private rooms = new Map<string, Set<string>>(); // channelId -> Set of userIds
  private userRooms = new Map<string, Set<string>>(); // userId -> Set of channelIds
  private roomMetadata = new Map<string, RoomMetadata>(); // channelId -> metadata
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, ROOM_CLEANUP_CONFIG.CLEANUP_INTERVAL_MS);
  }

  private cleanupInactiveRooms() {
    const now = new Date();
    const roomsToCleanup: string[] = [];

    // Identify rooms for cleanup
    for (const [channelId, metadata] of this.roomMetadata.entries()) {
      const timeSinceLastActivity = now.getTime() - metadata.lastActivity.getTime();
      const isEmpty = metadata.memberCount === 0;

      // Check if room should be cleaned up
      if (
        // Room is empty and past empty room timeout
        (isEmpty && timeSinceLastActivity > ROOM_CLEANUP_CONFIG.EMPTY_ROOM_TIMEOUT_MS) ||
        // Room is inactive past timeout
        timeSinceLastActivity > ROOM_CLEANUP_CONFIG.INACTIVE_TIMEOUT_MS
      ) {
        roomsToCleanup.push(channelId);
      }
    }

    // Cleanup identified rooms
    for (const channelId of roomsToCleanup) {
      this.cleanupRoom(channelId);
    }

    if (roomsToCleanup.length > 0) {
      console.log(`Cleaned up ${roomsToCleanup.length} inactive rooms: ${roomsToCleanup.join(', ')}`);
    }
  }

  private cleanupRoom(channelId: string) {
    // Get all users in the room
    const users = this.getRoomMembers(channelId);
    
    // Remove room from all users' room lists
    for (const userId of users) {
      this.userRooms.get(userId)?.delete(channelId);
      if (this.userRooms.get(userId)?.size === 0) {
        this.userRooms.delete(userId);
      }
    }

    // Remove room data
    this.rooms.delete(channelId);
    this.roomMetadata.delete(channelId);

    return users;
  }

  // Add method to manually trigger cleanup
  forceCleanupRoom(channelId: string): string[] {
    return this.cleanupRoom(channelId);
  }

  // Add method to check if room should be cleaned up
  shouldCleanupRoom(channelId: string): boolean {
    const metadata = this.roomMetadata.get(channelId);
    if (!metadata) return true;

    const now = new Date();
    const timeSinceLastActivity = now.getTime() - metadata.lastActivity.getTime();
    const isEmpty = metadata.memberCount === 0;

    return (
      (isEmpty && timeSinceLastActivity > ROOM_CLEANUP_CONFIG.EMPTY_ROOM_TIMEOUT_MS) ||
      timeSinceLastActivity > ROOM_CLEANUP_CONFIG.INACTIVE_TIMEOUT_MS
    );
  }

  joinRoom(channelId: string, userId: string, user: User) {
    this.initializeRoom(channelId);
    
    this.rooms.get(channelId)?.add(userId);

    // Update metadata
    const metadata = this.roomMetadata.get(channelId);
    if (metadata) {
      metadata.lastActivity = new Date();
      metadata.memberCount = this.rooms.get(channelId)?.size || 0;
      metadata.activeMembers.set(userId, {
        joinedAt: new Date(),
        user
      });
      this.roomMetadata.set(channelId, metadata);
    }

    // Add room to user's rooms
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId)?.add(channelId);
  }

  leaveRoom(channelId: string, userId: string) {
    // Remove user from room
    this.rooms.get(channelId)?.delete(userId);
    
    // Update metadata
    const metadata = this.roomMetadata.get(channelId);
    if (metadata) {
      metadata.lastActivity = new Date();
      metadata.memberCount = this.rooms.get(channelId)?.size || 0;
      metadata.activeMembers.delete(userId);
      this.roomMetadata.set(channelId, metadata);

      // If room is empty, schedule it for cleanup
      if (metadata.memberCount === 0) {
        setTimeout(() => {
          // Double check if still empty before cleanup
          const currentMetadata = this.roomMetadata.get(channelId);
          if (currentMetadata?.memberCount === 0) {
            this.cleanupRoom(channelId);
          }
        }, ROOM_CLEANUP_CONFIG.EMPTY_ROOM_TIMEOUT_MS);
      }
    }

    // Remove room from user's rooms
    this.userRooms.get(userId)?.delete(channelId);
    if (this.userRooms.get(userId)?.size === 0) {
      this.userRooms.delete(userId);
    }
  }

  updateRoomActivity(channelId: string) {
    const metadata = this.roomMetadata.get(channelId);
    if (metadata) {
      metadata.lastActivity = new Date();
      this.roomMetadata.set(channelId, metadata);
    }
  }

  getRoomMetadata(channelId: string): RoomMetadata | undefined {
    return this.roomMetadata.get(channelId);
  }

  getRoomMembers(channelId: string): string[] {
    return Array.from(this.rooms.get(channelId) || []);
  }

  getActiveMembers(channelId: string): User[] {
    const metadata = this.roomMetadata.get(channelId);
    if (!metadata) return [];
    
    return Array.from(metadata.activeMembers.values()).map(member => member.user);
  }

  getUserRooms(userId: string): string[] {
    return Array.from(this.userRooms.get(userId) || []);
  }

  getRoomMemberCount(channelId: string): number {
    return this.roomMetadata.get(channelId)?.memberCount || 0;
  }

  isUserInRoom(channelId: string, userId: string): boolean {
    return this.rooms.get(channelId)?.has(userId) || false;
  }

  updateMessageActivity(channelId: string, message: Message) {
    const metadata = this.roomMetadata.get(channelId);
    if (metadata) {
      metadata.lastActivity = new Date();
      metadata.lastMessage = {
        id: message.id,
        content: message.content,
        userId: message.userId,
        timestamp: new Date(message.createdAt)
      };
      this.roomMetadata.set(channelId, metadata);
    }
  }

  startTyping(channelId: string, userId: string, user: User) {
    const metadata = this.roomMetadata.get(channelId);
    if (metadata) {
      metadata.typingUsers.set(userId, {
        user,
        startedAt: new Date()
      });
      this.roomMetadata.set(channelId, metadata);
    }
  }

  stopTyping(channelId: string, userId: string) {
    const metadata = this.roomMetadata.get(channelId);
    if (metadata) {
      metadata.typingUsers.delete(userId);
      this.roomMetadata.set(channelId, metadata);
    }
  }

  getTypingUsers(channelId: string): User[] {
    const metadata = this.roomMetadata.get(channelId);
    if (!metadata) return [];
    
    // Clean up stale typing indicators (older than 5 seconds)
    const now = new Date();
    for (const [userId, data] of metadata.typingUsers.entries()) {
      if (now.getTime() - data.startedAt.getTime() > 5000) {
        metadata.typingUsers.delete(userId);
      }
    }
    
    return Array.from(metadata.typingUsers.values()).map(data => data.user);
  }

  initializeRoom(channelId: string) {
    if (!this.rooms.has(channelId)) {
      this.rooms.set(channelId, new Set());
      this.roomMetadata.set(channelId, {
        createdAt: new Date(),
        lastActivity: new Date(),
        memberCount: 0,
        activeMembers: new Map(),
        typingUsers: new Map()
      });
    }
  }
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  path: '/api/socket.io',
  transports: ['websocket']
})
@Injectable()
@UseGuards(WsAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private roomManager = new RoomManager();

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly websocketService: WebsocketService,
    private readonly usersService: UsersService,
    private readonly messagesService: MessagesService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const { userId } = client.handshake.auth;
      if (!userId) {
        throw new WsException('Authentication failed');
      }

      this.logger.log(`Client connecting: ${client.id} (userId: ${userId})`);
      
      // Get real user data from database
      const userData = await this.usersService.getUser(userId);
      if (!userData) {
        throw new WsException('User not found');
      }
      
      // Create user object with full data
      const user: User = {
        id: userId,
        name: userData.name,
        fullName: userData.name, // Using name as fullName since that's what we store
        imageUrl: userData.imageUrl
      };
      
      // Store user data and socket
      this.websocketService.setUserSocket(userId, client, user);
      
      client.emit('connection:starting');
      
      // Join user's previous rooms if any, checking for inactive rooms
      const userRooms = this.roomManager.getUserRooms(userId);
      if (userRooms.length > 0) {
        const activeRooms = userRooms.filter(roomId => !this.roomManager.shouldCleanupRoom(roomId));
        if (activeRooms.length > 0) {
          await Promise.all(activeRooms.map(roomId => client.join(roomId)));
          this.logger.log(`Rejoined user ${userId} to rooms: ${activeRooms.join(', ')}`);
        }
        
        // Notify about inactive rooms
        const inactiveRooms = userRooms.filter(roomId => this.roomManager.shouldCleanupRoom(roomId));
        if (inactiveRooms.length > 0) {
          client.emit('room:inactive', {
            roomIds: inactiveRooms,
            reason: 'INACTIVE_TIMEOUT'
          });
        }
      }
      
      client.emit('connection:ready');
      
      // Emit user:online with full user data
      this.server.emit('user:online', { userId, user });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('connection:error', { message: error.message });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const { userId } = client.handshake.auth;
    if (userId) {
      // Don't remove from rooms on disconnect to allow rejoining
      this.websocketService.removeUserSocket(userId);
      this.server.emit('user:offline', { userId });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('channel:create')
  async handleChannelCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChannelCreatePayload
  ): Promise<WsResponse<Channel>> {
    try {
      const { userId } = client.handshake.auth;

      // Create channel in database
      const channel = await this.channelsService.createChannel(userId, {
        name: payload.name,
        type: payload.type,
        description: payload.description,
        memberIds: payload.memberIds
      });

      // Get user data
      const userData = await this.usersService.getUser(userId);
      if (!userData) {
        throw new WsException('User not found');
      }

      // Initialize room for the channel
      const user: User = {
        id: userId,
        name: userData.name,
        fullName: userData.name,
        imageUrl: userData.imageUrl
      };
      
      this.roomManager.joinRoom(channel.id, userId, user);
      await client.join(channel.id);

      // Notify room creation
      this.server.emit('channel:created', {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        memberCount: 1,
        members: [{
          userId,
          role: 'OWNER',
          user
        }]
      });

      return { 
        success: true, 
        data: {
          id: channel.id,
          name: channel.name,
          description: channel.description,
          type: channel.type,
          memberCount: 1,
          members: [{
            userId,
            role: 'OWNER',
            user
          }]
        }
      };
    } catch (error) {
      this.logger.error(`Error creating channel: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('channel:update')
  async handleChannelUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChannelUpdatePayload
  ): Promise<WsResponse<Channel>> {
    try {
      // TODO: Implement channel update logic
      const channel: Channel = {
        id: payload.channelId,
        name: payload.name || 'Updated Channel',
        type: 'PUBLIC',
        memberCount: 1,
        members: []
      };

      this.server.emit('channel:updated', channel);
      return { success: true, data: channel };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('channel:join')
  async handleChannelJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChannelJoinPayload
  ): Promise<WsResponse> {
    try {
      const { userId } = client.handshake.auth;
      await client.join(payload.channelId);
      
      // Get user data
      const userData = await this.usersService.getUser(userId);
      if (!userData) {
        throw new WsException('User not found');
      }
      
      // Create user object with real data
      const user: User = {
        id: userId,
        name: userData.name,
        fullName: userData.name,
        imageUrl: userData.imageUrl
      };
      
      this.roomManager.joinRoom(payload.channelId, userId, user);
      
      // Emit member joined event
      this.server.to(payload.channelId).emit('room:member:joined', {
        channelId: payload.channelId,
        userId,
        user,
        timestamp: new Date().toISOString()
      });

      // Emit updated room activity
      const metadata = this.roomManager.getRoomMetadata(payload.channelId);
      if (metadata) {
        this.server.to(payload.channelId).emit('room:activity', {
          channelId: payload.channelId,
          memberCount: metadata.memberCount,
          lastActivity: metadata.lastActivity.toISOString(),
          activeMembers: this.roomManager.getActiveMembers(payload.channelId)
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('channel:leave')
  async handleChannelLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChannelLeavePayload
  ): Promise<WsResponse> {
    try {
      const { userId } = client.handshake.auth;

      // Remove from database first
      const { wasDeleted } = await this.channelsService.removeMember(userId, payload.channelId);
      
      // Leave socket room
      await client.leave(payload.channelId);
      
      // Emit member left event before removing from room
      this.server.to(payload.channelId).emit('room:member:left', {
        channelId: payload.channelId,
        userId,
        timestamp: new Date().toISOString()
      });
      
      this.roomManager.leaveRoom(payload.channelId, userId);
      
      if (wasDeleted) {
        // Force cleanup the room immediately
        const affectedUsers = this.roomManager.forceCleanupRoom(payload.channelId);
        
        // Notify all affected users
        for (const affectedUserId of affectedUsers) {
          const socket = this.websocketService.getUserSocket(affectedUserId);
          if (socket) {
            socket.emit('room:deleted', {
              channelId: payload.channelId,
              reason: 'LAST_MEMBER_LEFT'
            });
          }
        }
      } else {
        // Emit updated room activity
        const metadata = this.roomManager.getRoomMetadata(payload.channelId);
        if (metadata) {
          this.server.to(payload.channelId).emit('room:activity', {
            channelId: payload.channelId,
            memberCount: metadata.memberCount,
            lastActivity: metadata.lastActivity.toISOString(),
            activeMembers: this.roomManager.getActiveMembers(payload.channelId)
          });

          // If room is empty, notify remaining subscribed clients
          if (metadata.memberCount === 0) {
            this.server.to(payload.channelId).emit('room:inactive', {
              channelId: payload.channelId,
              reason: 'EMPTY_ROOM',
              cleanupTimeout: ROOM_CLEANUP_CONFIG.EMPTY_ROOM_TIMEOUT_MS
            });
          }
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error leaving channel: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('channel:member:role')
  async handleChannelMemberRole(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChannelMemberRolePayload
  ): Promise<WsResponse> {
    try {
      // TODO: Implement role update logic
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageSendPayload
  ): Promise<WsResponse<Message>> {
    try {
      const { userId } = client.handshake.auth;
      
      // Get user data
      const userData = await this.usersService.getUser(userId);
      if (!userData) {
        throw new WsException('User not found');
      }
      
      // Create user object with real data
      const user: User = {
        id: userId,
        name: userData.name,
        fullName: userData.name,
        imageUrl: userData.imageUrl
      };

      // Create temporary message for immediate broadcast
      const tempMessage: Message = {
        id: `temp-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: payload.content,
        channelId: payload.channelId,
        userId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deliveryStatus: 'SENDING',
        user
      };

      // Step 1: Broadcast temporary message immediately
      this.server.to(payload.channelId).emit('message:new', {
        ...tempMessage,
        delivered: false
      });
      
      // Step 2: Persist message to database
      try {
        const dbMessage = await this.messagesService.createMessage(userId, {
          content: payload.content,
          channelId: payload.channelId
        });

        // Convert database message to WebSocket message format
        const savedMessage: Message = {
          id: dbMessage.id,
          content: dbMessage.content,
          channelId: dbMessage.channelId,
          userId: dbMessage.userId,
          createdAt: dbMessage.createdAt.toISOString(),
          updatedAt: dbMessage.updatedAt.toISOString(),
          deliveryStatus: 'SENT',
          user: {
            id: dbMessage.user.id,
            name: dbMessage.user.name || '',
            fullName: dbMessage.user.name || '',
            imageUrl: dbMessage.user.imageUrl || undefined
          }
        };

        // Step 3: Notify sender that message was saved
        client.emit('message:saved', {
          tempId: tempMessage.id,
          message: savedMessage
        });

        // Step 4: Broadcast the persisted message to all clients
        this.server.to(payload.channelId).emit('message:new', {
          ...savedMessage,
          delivered: true
        });

        // Update room activity with saved message
        this.roomManager.updateMessageActivity(payload.channelId, savedMessage);
        
        // Stop typing indicator for this user
        this.roomManager.stopTyping(payload.channelId, userId);
        
        // Emit updated room activity
        const metadata = this.roomManager.getRoomMetadata(payload.channelId);
        if (metadata) {
          this.server.to(payload.channelId).emit('room:activity', {
            channelId: payload.channelId,
            memberCount: metadata.memberCount,
            lastActivity: metadata.lastActivity.toISOString(),
            activeMembers: this.roomManager.getActiveMembers(payload.channelId)
          });
        }

        return { success: true, data: savedMessage };
      } catch (error) {
        // If persistence fails, notify the client
        client.emit('message:error', {
          tempId: tempMessage.id,
          error: 'Failed to save message'
        });

        // Broadcast message failure to room
        this.server.to(payload.channelId).emit('message:new', {
          ...tempMessage,
          delivered: false,
          deliveryStatus: 'FAILED'
        });

        throw error;
      }
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageStatusPayload
  ): Promise<WsResponse> {
    try {
      this.server.emit('message:status', {
        messageId: payload.messageId,
        status: 'DELIVERED',
        userId: client.handshake.auth.userId
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageStatusPayload
  ): Promise<WsResponse> {
    try {
      this.server.emit('message:status', {
        messageId: payload.messageId,
        status: 'READ',
        userId: client.handshake.auth.userId
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageTypingPayload
  ): Promise<void> {
    const { userId } = client.handshake.auth;
    
    // Get user data
    const userData = await this.usersService.getUser(userId);
    if (!userData) {
      throw new WsException('User not found');
    }
    
    // Create user object with real data
    const user: User = {
      id: userId,
      name: userData.name,
      fullName: userData.name,
      imageUrl: userData.imageUrl
    };

    this.roomManager.startTyping(payload.channelId, userId, user);
    
    // Emit typing users update
    const typingUsers = this.roomManager.getTypingUsers(payload.channelId);
    this.server.to(payload.channelId).emit('user:typing', {
      channelId: payload.channelId,
      typingUsers
    });
  }

  @SubscribeMessage('message:typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageTypingPayload
  ): Promise<void> {
    const { userId } = client.handshake.auth;
    
    this.roomManager.stopTyping(payload.channelId, userId);
    
    // Emit typing users update
    const typingUsers = this.roomManager.getTypingUsers(payload.channelId);
    this.server.to(payload.channelId).emit('user:typing', {
      channelId: payload.channelId,
      typingUsers
    });
  }
} 