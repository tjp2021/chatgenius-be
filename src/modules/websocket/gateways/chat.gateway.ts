import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ReactionsService } from '../../messages/services/reactions.service';
import { PrismaService } from '../../../lib/prisma.service';
import { CreateMessageReactionDto, DeleteMessageReactionDto } from '../../messages/dto/message-reaction.dto';
import { MessagesService } from '../../messages/services/messages.service';

// Connection status tracking
enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

interface ReactionPayload {
  messageId: string;
  type: string;
  processed?: boolean;
}

interface MessagePayload {
  content: string;
  channelId: string;
  tempId?: string;
  processed?: boolean;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true
  },
  path: '/api/socket.io',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  connectTimeout: 10000, // 10 seconds
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private processingMessages: Set<string> = new Set();
  private processingReactions: Set<string> = new Set();
  private clientStatus: Map<string, ConnectionStatus> = new Map();
  private connectionAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECTION_ATTEMPTS = 5;
  private readonly wsAuthGuard: WsAuthGuard;

  constructor(
    private readonly reactionsService: ReactionsService,
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
  ) {
    this.wsAuthGuard = new WsAuthGuard();
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    
    // Configure server-wide error handling
    server.engine.on('connection_error', (err) => {
      this.logger.error(`Connection error: ${err.message}`, err.stack);
    });

    // Handle transport errors
    server.engine.on('transport_error', (err) => {
      this.logger.error(`Transport error: ${err.message}`, err.stack);
    });
  }

  private handleConnectionError(client: Socket, error: Error, reason: string) {
    this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
    this.clientStatus.set(client.id, ConnectionStatus.ERROR);
    client.emit('connection:error', { 
      error: error.message, 
      reason,
      reconnectAttempt: this.connectionAttempts.get(client.id) || 0
    });
    client.disconnect(true);
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);
      this.logger.debug('Connection handshake data:', {
        auth: client.handshake.auth,
        headers: client.handshake.headers,
        query: client.handshake.query
      });

      this.clientStatus.set(client.id, ConnectionStatus.CONNECTING);
      
      // Track connection attempts
      const attempts = (this.connectionAttempts.get(client.id) || 0) + 1;
      this.connectionAttempts.set(client.id, attempts);

      if (attempts > this.MAX_RECONNECTION_ATTEMPTS) {
        throw new Error(`Max reconnection attempts (${this.MAX_RECONNECTION_ATTEMPTS}) exceeded`);
      }

      // Explicitly run auth guard
      const context = {
        switchToWs: () => ({
          getClient: () => client
        })
      };
      
      const isAuthenticated = await this.wsAuthGuard.canActivate(context as any);
      if (!isAuthenticated) {
        throw new Error('Authentication failed');
      }

      // After successful authentication, userId should be in client.data
      const userId = client.data?.userId;
      this.logger.log(`Connection userId: ${userId}`);
      
      if (!userId) {
        throw new Error('No userId found in connection data');
      }

      this.clientStatus.set(client.id, ConnectionStatus.AUTHENTICATED);

      // Join user's channels
      const channels = await this.prisma.channelMember.findMany({
        where: { userId },
        select: { channelId: true }
      });
      
      this.logger.log(`Found ${channels.length} channels for user ${userId}`);
      
      for (const { channelId } of channels) {
        await client.join(channelId);
        this.logger.log(`Client ${client.id} joined room: ${channelId}`);
      }

      // Setup client-specific error handlers
      client.on('error', (error) => {
        this.logger.error(`Client ${client.id} error: ${error.message}`);
        this.handleConnectionError(client, error, 'client_error');
      });

      // Setup ping timeout handler
      client.on('ping_timeout', () => {
        this.logger.warn(`Client ${client.id} ping timeout`);
        this.handleConnectionError(client, new Error('Ping timeout'), 'ping_timeout');
      });

      this.clientStatus.set(client.id, ConnectionStatus.CONNECTED);
      this.logger.log(`Client successfully connected: ${client.id}`);
      
      // Notify client of successful connection
      client.emit('connection:success', {
        userId,
        channels: channels.map(c => c.channelId)
      });

    } catch (error) {
      this.handleConnectionError(client, error, 'connection_error');
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.logger.debug(`Disconnect status: ${this.clientStatus.get(client.id)}`);
    
    // Cleanup client state
    this.clientStatus.set(client.id, ConnectionStatus.DISCONNECTED);
    
    // If this was a clean disconnect, reset connection attempts
    if (client.disconnected && !client.connected) {
      this.connectionAttempts.delete(client.id);
    }
    
    // Cleanup any processing states
    for (const key of this.processingMessages) {
      if (key.startsWith(`${client.id}:`)) {
        this.processingMessages.delete(key);
      }
    }
    
    for (const key of this.processingReactions) {
      if (key.startsWith(`${client.id}:`)) {
        this.processingReactions.delete(key);
      }
    }
  }

  @SubscribeMessage('message:send')
  async handleMessageSent(
    @MessageBody() data: MessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Received message:send event from client ${client.id}`, data);
    
    const messageKey = `${client.id}:${data.tempId || data.content}`;
    if (this.processingMessages.has(messageKey)) {
      this.logger.warn(`Duplicate message processing prevented: ${messageKey}`);
      return { success: false, error: 'Message already being processed' };
    }

    try {
      this.processingMessages.add(messageKey);
      const userId = client.data?.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      this.logger.log(`Creating message from user ${userId} in channel ${data.channelId} with tempId ${data.tempId}`);

      const message = await this.messagesService.createMessage(userId, {
        content: data.content,
        channelId: data.channelId,
      });

      this.logger.log(`Message created successfully with ID ${message.id}`);

      const deliveredMessage = await this.messagesService.updateMessageDeliveryStatus(
        message.id,
        'DELIVERED'
      );

      client.emit('message:delivered', {
        messageId: deliveredMessage.id,
        tempId: data.tempId,
        status: deliveredMessage.deliveryStatus,
        processed: true
      });

      client.to(data.channelId).emit('message:created', {
        message: deliveredMessage,
        tempId: data.tempId,
        processed: true
      });

      return { 
        success: true, 
        data: deliveredMessage,
        processed: true
      };
    } catch (error) {
      this.logger.error('Error sending message:', error.stack);
      
      if (data.tempId) {
        client.emit('message:failed', {
          error: error.message,
          tempId: data.tempId,
          status: 'FAILED',
          processed: true
        });
      }
      
      throw error;
    } finally {
      this.processingMessages.delete(messageKey);
    }
  }

  @SubscribeMessage('reaction:add')
  async handleReactionAdded(
    @MessageBody() data: ReactionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const reactionKey = `${client.id}:${data.messageId}:${data.type}`;
    if (this.processingReactions.has(reactionKey)) {
      this.logger.warn(`Duplicate reaction processing prevented: ${reactionKey}`);
      return { success: false, error: 'Reaction already being processed' };
    }

    try {
      this.processingReactions.add(reactionKey);
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const dto: CreateMessageReactionDto = {
        type: data.type
      };

      const reaction = await this.reactionsService.addReaction(userId, data.messageId, dto);

      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { channelId: true },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      this.server.to(message.channelId).emit('reaction:added', {
        messageId: data.messageId,
        reaction,
        processed: true
      });

      return { success: true, data: reaction, processed: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.processingReactions.delete(reactionKey);
    }
  }

  @SubscribeMessage('reaction:remove')
  async handleReactionRemoved(
    @MessageBody() data: ReactionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const reactionKey = `${client.id}:${data.messageId}:${data.type}:remove`;
    if (this.processingReactions.has(reactionKey)) {
      this.logger.warn(`Duplicate reaction removal prevented: ${reactionKey}`);
      return { success: false, error: 'Reaction removal already being processed' };
    }

    try {
      this.processingReactions.add(reactionKey);
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const dto: DeleteMessageReactionDto = {
        type: data.type
      };

      await this.reactionsService.removeReaction(userId, data.messageId, dto);

      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { channelId: true },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      this.server.to(message.channelId).emit('reaction:removed', {
        messageId: data.messageId,
        userId,
        type: data.type,
        processed: true
      });

      return { success: true, processed: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.processingReactions.delete(reactionKey);
    }
  }

  @SubscribeMessage('channel:join')
  async handleJoinChannel(
    @MessageBody() data: { channelId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      this.logger.log(`User ${userId} attempting to join channel ${data.channelId}`);

      // Verify user has access to channel
      const member = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: data.channelId,
            userId,
          },
        },
      });

      if (!member) {
        throw new Error('Access denied to channel');
      }

      // Join the socket room for this channel
      await client.join(data.channelId);
      this.logger.log(`User ${userId} joined channel ${data.channelId}`);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error joining channel: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('channel:leave')
  async handleLeaveChannel(
    @MessageBody() data: { channelId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      await client.leave(data.channelId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
} 