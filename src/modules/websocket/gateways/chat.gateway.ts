import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ReactionsService } from '../../messages/services/reactions.service';
import { PrismaService } from '../../../lib/prisma.service';
import { CreateMessageReactionDto, DeleteMessageReactionDto } from '../../messages/dto/message-reaction.dto';
import { MessagesService } from '../../messages/services/messages.service';

/**
 * WebSocket Gateway for Chat Functionality
 * 
 * Configuration:
 * - WebSocket server runs on ws://localhost:3002/socket.io
 * - Supports both websocket and polling transports
 * - CORS enabled with credentials
 * - Ping timeout: 60s, Ping interval: 25s, Connect timeout: 10s
 * 
 * Authentication Flow:
 * 1. Client connects with auth data: { token: "Bearer <clerk-jwt>", userId: "<clerk-user-id>" }
 * 2. WsAuthGuard validates token and userId
 * 3. User data stored in socket.data after authentication
 * 
 * Connection States (ConnectionStatus enum):
 * - CONNECTING: Initial connection attempt
 * - CONNECTED: Socket connected but not authenticated
 * - AUTHENTICATED: Successfully authenticated
 * - DISCONNECTED: Connection terminated
 * - ERROR: Connection/auth error occurred
 * 
 * Events Handled:
 * - message:send -> message:delivered, message:created
 * - reaction:add -> reaction:added
 * - reaction:remove -> reaction:removed
 * - channel:join
 * - channel:leave
 * 
 * Anti-Recursion Protection:
 * - Uses processingMessages and processingReactions Sets
 * - Tracks message/reaction processing state by client+content
 * - Prevents duplicate event processing
 */

// Connection status tracking
enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

/**
 * Payload for reaction events
 * Used by reaction:add and reaction:remove events
 */
interface ReactionPayload {
  messageId: string;  // ID of message being reacted to
  type: string;      // Type of reaction (emoji)
  processed?: boolean; // Flag to prevent duplicate processing
}

/**
 * Payload for message events
 * Used by message:send event
 */
interface MessagePayload {
  content: string;    // Message content
  channelId: string;  // Target channel ID
  tempId?: string;    // Temporary client-side ID for tracking
  processed?: boolean; // Flag to prevent duplicate processing
}

/**
 * Payload for thread events
 * Used by thread:reply event
 */
interface ThreadMessagePayload {
  content: string;     // Message content
  threadId: string;    // Parent message ID that started the thread
  channelId: string;   // Channel ID where the thread exists
  tempId?: string;     // Temporary client-side ID for tracking
  processed?: boolean; // Flag to prevent duplicate processing
}

/**
 * Payload for thread join/leave events
 */
interface ThreadRoomPayload {
  threadId: string;    // Parent message ID that started the thread
  channelId: string;   // Channel ID where the thread exists
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true
  },
  /** 
   * DO NOT FUCKING TOUCH THIS CONFIG PATH. DO NOT FUCKING EDIT IT
   * */ 
  path: '/socket.io',
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

    // Add raw event logging
    server.engine.on('packet', (packet) => {
      this.logger.debug('[Raw Socket Packet]', { packet });
    });

    // Log all incoming events
    server.on('connection', (socket) => {
      socket.onAny((eventName, ...args) => {
        this.logger.debug(`[Raw Socket Event] ${eventName}`, {
          socketId: socket.id,
          userId: socket.data?.userId,
          args
        });
      });
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

  /**
   * Handles new socket connections
   * Connection Flow:
   * 1. Log connection attempt
   * 2. Set initial connection status
   * 3. Track connection attempts (max 5)
   * 4. Authenticate via WsAuthGuard
   * 5. Extract and verify userId
   * 6. Join user's channel rooms
   * 7. Setup error handlers
   * 8. Emit success event
   */
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

  /**
   * Handles socket disconnections
   * Cleanup Flow:
   * 1. Log disconnection
   * 2. Update connection status
   * 3. Reset connection attempts if clean disconnect
   * 4. Clean up message/reaction processing states
   */
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

  /**
   * Handles message sending
   * Message Flow:
   * 1. Generate unique message key (clientId:tempId/content)
   * 2. Check for duplicate processing
   * 3. Create message in database
   * 4. Update delivery status
   * 5. Emit to sender: message:delivered
   * 6. Emit to channel: message:created
   * 
   * @param data MessagePayload with content, channelId, tempId
   * @param client Connected socket client
   */
  @SubscribeMessage('message:send')
  async handleMessageSent(
    @MessageBody() data: MessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('=== HANDLER TRIGGERED ===');
    this.logger.debug('Message payload received:', data);
    
    // Log raw incoming message event
    this.logger.debug('[Raw Message Event]', {
      event: 'message:send',
      socketId: client.id,
      userId: client.data?.userId,
      rawData: data,
      timestamp: new Date().toISOString()
    });

    this.logger.log(`[Start] Processing message:send event from client ${client.id}`);
    this.logger.debug('Message payload:', { 
      content: data.content,
      channelId: data.channelId,
      tempId: data.tempId,
      clientId: client.id
    });
    
    const messageKey = `${client.id}:${data.tempId || data.content}`;
    if (this.processingMessages.has(messageKey)) {
      this.logger.warn(`[Duplicate] Message processing prevented: ${messageKey}`);
      return { success: false, error: 'Message already being processed' };
    }

    try {
      this.processingMessages.add(messageKey);
      this.logger.debug(`[Processing] Added message key to processing set: ${messageKey}`);
      
      const userId = client.data?.userId;
      if (!userId) {
        this.logger.error('[Auth Error] User not authenticated for message send');
        throw new Error('User not authenticated');
      }

      this.logger.log(`[DB Create] Creating message from user ${userId} in channel ${data.channelId}`);
      this.logger.debug('Message creation details:', {
        userId,
        channelId: data.channelId,
        content: data.content,
        tempId: data.tempId
      });

      const message = await this.messagesService.createMessage(userId, {
        content: data.content,
        channelId: data.channelId,
      });

      this.logger.log(`[DB Success] Message created with ID ${message.id}`);
      this.logger.debug('Created message details:', { message });

      this.logger.log(`[DB Update] Updating message delivery status for ID ${message.id}`);
      const deliveredMessage = await this.messagesService.updateMessageDeliveryStatus(
        message.id,
        'DELIVERED'
      );
      this.logger.debug('Updated message details:', { deliveredMessage });

      this.logger.log(`[Emit] Sending message:delivered to sender (client ${client.id})`);
      const deliveredPayload = {
        messageId: deliveredMessage.id,
        tempId: data.tempId,
        status: deliveredMessage.deliveryStatus,
        processed: true
      };
      this.logger.debug('[Outgoing Event] message:delivered payload:', deliveredPayload);
      this.server.to(client.id).emit('message:delivered', deliveredPayload);

      this.logger.log(`[Broadcast] Broadcasting message:created to channel ${data.channelId}`);
      const createdPayload = {
        message: deliveredMessage,
        tempId: data.tempId,
        processed: true
      };
      this.logger.debug('[Outgoing Event] message:created payload:', createdPayload);
      this.server.to(data.channelId).emit('message:created', createdPayload);

      this.logger.log(`[Complete] Successfully processed message:send event`);
      const response = { 
        success: true, 
        data: deliveredMessage,
        processed: true
      };
      this.logger.debug('[Outgoing Event] message:send response:', response);
      return response;
    } catch (error) {
      this.logger.error('[Error] Error processing message:send event:', error.stack);
      this.logger.debug('Error context:', {
        clientId: client.id,
        messageKey,
        channelId: data.channelId,
        tempId: data.tempId
      });
      
      if (data.tempId) {
        this.logger.log(`[Error Emit] Sending message:failed to client ${client.id}`);
        client.emit('message:failed', {
          error: error.message,
          tempId: data.tempId,
          status: 'FAILED',
          processed: true
        });
      }
      
      throw error;
    } finally {
      this.logger.debug(`[Cleanup] Removing message key from processing set: ${messageKey}`);
      this.processingMessages.delete(messageKey);
    }
  }

  /**
   * Handles adding reactions
   * Reaction Flow:
   * 1. Generate unique reaction key (clientId:messageId:type)
   * 2. Check for duplicate processing
   * 3. Add reaction in database
   * 4. Emit to channel: reaction:added
   * 
   * @param data ReactionPayload with messageId and type
   * @param client Connected socket client
   */
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

  /**
   * Handles removing reactions
   * Reaction Removal Flow:
   * 1. Generate unique reaction key (clientId:messageId:type:remove)
   * 2. Check for duplicate processing
   * 3. Remove reaction from database
   * 4. Emit to channel: reaction:removed
   * 
   * @param data ReactionPayload with messageId and type
   * @param client Connected socket client
   */
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

  /**
   * Handles channel join requests
   * Join Flow:
   * 1. Verify user authentication
   * 2. Check user's channel membership
   * 3. Join socket room for channel
   * 4. Return success status
   * 
   * @param data Object containing channelId
   * @param client Connected socket client
   */
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

  /**
   * Handles channel leave requests
   * Leave Flow:
   * 1. Leave socket room for channel
   * 2. Return success status
   * 
   * @param data Object containing channelId
   * @param client Connected socket client
   */
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

  /**
   * Handles thread join requests
   * Thread Join Flow:
   * 1. Verify user authentication
   * 2. Join socket room for thread
   * 3. Return success status
   * 
   * @param data ThreadRoomPayload containing threadId and channelId
   * @param client Connected socket client
   */
  @SubscribeMessage('thread:join')
  async handleThreadJoin(
    @MessageBody() data: ThreadRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      this.logger.log(`[Thread] User ${userId} joining thread ${data.threadId}`);
      
      // Join the thread room
      const threadRoom = `thread:${data.threadId}`;
      await client.join(threadRoom);
      
      this.logger.log(`[Thread] Client ${client.id} joined thread room: ${threadRoom}`);
      
      // Broadcast to thread room that user joined
      this.server.to(threadRoom).emit('thread:joined', {
        threadId: data.threadId,
        userId,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`[Thread] Error joining thread: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles thread leave requests
   * Thread Leave Flow:
   * 1. Leave thread room
   * 2. Broadcast departure
   * 3. Return success status
   * 
   * @param data ThreadRoomPayload containing threadId and channelId
   * @param client Connected socket client
   */
  @SubscribeMessage('thread:leave')
  async handleThreadLeave(
    @MessageBody() data: ThreadRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data?.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      this.logger.log(`[Thread] User ${userId} leaving thread ${data.threadId}`);
      
      const threadRoom = `thread:${data.threadId}`;
      await client.leave(threadRoom);
      
      // Broadcast to remaining thread participants
      this.server.to(threadRoom).emit('thread:left', {
        threadId: data.threadId,
        userId,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`[Thread] Error leaving thread: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles thread replies
   * Thread Reply Flow:
   * 1. Generate unique message key
   * 2. Check for duplicate processing
   * 3. Create message in database with threadId
   * 4. Update delivery status
   * 5. Emit to sender: thread:reply:delivered
   * 6. Emit to thread room: thread:reply:created
   * 
   * @param data ThreadMessagePayload with content and threadId
   * @param client Connected socket client
   */
  @SubscribeMessage('thread:reply')
  async handleThreadReply(
    @MessageBody() data: ThreadMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('[Thread] === HANDLER TRIGGERED ===');
    this.logger.debug('[Thread] Reply payload received:', data);

    const messageKey = `${client.id}:thread:${data.tempId || data.content}`;
    if (this.processingMessages.has(messageKey)) {
      this.logger.warn(`[Thread] [Duplicate] Reply processing prevented: ${messageKey}`);
      return { success: false, error: 'Message already being processed' };
    }

    try {
      this.processingMessages.add(messageKey);
      this.logger.debug(`[Thread] [Processing] Added reply key to processing set: ${messageKey}`);
      
      const userId = client.data?.userId;
      if (!userId) {
        this.logger.error('[Thread] [Auth Error] User not authenticated for thread reply');
        throw new Error('User not authenticated');
      }

      this.logger.log(`[Thread] [DB Create] Creating reply from user ${userId} in thread ${data.threadId}`);
      
      // Create the thread reply
      const message = await this.messagesService.createMessage(userId, {
        content: data.content,
        channelId: data.channelId,
        replyToId: data.threadId, // This marks it as a thread reply
      });

      this.logger.log(`[Thread] [DB Success] Reply created with ID ${message.id}`);
      
      // Update delivery status
      const deliveredMessage = await this.messagesService.updateMessageDeliveryStatus(
        message.id,
        'DELIVERED'
      );

      // Emit delivery confirmation to sender
      const deliveredPayload = {
        messageId: deliveredMessage.id,
        threadId: data.threadId,
        tempId: data.tempId,
        status: deliveredMessage.deliveryStatus,
        processed: true
      };
      
      this.logger.debug('[Thread] [Outgoing Event] thread:reply:delivered payload:', deliveredPayload);
      this.server.to(client.id).emit('thread:reply:delivered', deliveredPayload);

      // Broadcast to thread room
      const threadRoom = `thread:${data.threadId}`;
      const createdPayload = {
        message: deliveredMessage,
        threadId: data.threadId,
        tempId: data.tempId,
        processed: true
      };
      
      this.logger.debug('[Thread] [Outgoing Event] thread:reply:created payload:', createdPayload);
      this.server.to(threadRoom).emit('thread:reply:created', createdPayload);

      // Also broadcast to channel for thread count updates
      this.server.to(data.channelId).emit('thread:updated', {
        threadId: data.threadId,
        replyCount: await this.messagesService.getThreadReplyCount(data.threadId),
        lastReply: deliveredMessage,
        processed: true
      });

      return { success: true, data: deliveredMessage, processed: true };
    } catch (error) {
      this.logger.error('[Thread] [Error] Error processing thread reply:', error.stack);
      
      if (data.tempId) {
        client.emit('thread:reply:failed', {
          error: error.message,
          threadId: data.threadId,
          tempId: data.tempId,
          status: 'FAILED',
          processed: true
        });
      }
      
      throw error;
    } finally {
      this.logger.debug(`[Thread] [Cleanup] Removing reply key from processing set: ${messageKey}`);
      this.processingMessages.delete(messageKey);
    }
  }
} 