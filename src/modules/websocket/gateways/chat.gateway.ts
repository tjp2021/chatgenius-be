import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ReactionsService } from '../../messages/services/reactions.service';
import { CreateMessageReactionDto, DeleteMessageReactionDto } from '../../messages/dto/message-reaction.dto';
import { MessageEvent } from '../../messages/dto/message-events.enum';
import { PrismaService } from '../../../lib/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  namespace: '/api',
  path: '/socket.io',
  transports: ['websocket', 'polling']
})
@UseGuards(WsAuthGuard)
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly reactionsService: ReactionsService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string }
  ) {
    try {
      const userId = client.data.userId;
      
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
        return { success: false, error: 'Access denied to channel' };
      }

      await client.join(`channel:${data.channelId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('leave_channel')
  async handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string }
  ) {
    try {
      await client.leave(`channel:${data.channelId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(MessageEvent.REACTION_ADDED)
  async handleReactionAdded(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateMessageReactionDto,
  ) {
    try {
      const userId = client.data.userId;
      const reaction = await this.reactionsService.addReaction(userId, data);
      
      // Get the message to get its channelId
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { channelId: true },
      });

      if (message) {
        // Broadcast to all users in the channel
        this.server.to(`channel:${message.channelId}`).emit(MessageEvent.REACTION_ADDED, reaction);
      }

      return { success: true, data: reaction };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(MessageEvent.REACTION_REMOVED)
  async handleReactionRemoved(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DeleteMessageReactionDto,
  ) {
    try {
      const userId = client.data.userId;
      await this.reactionsService.removeReaction(userId, data);

      // Get the message to get its channelId
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { channelId: true },
      });

      if (message) {
        // Broadcast to all users in the channel
        this.server.to(`channel:${message.channelId}`).emit(MessageEvent.REACTION_REMOVED, {
          messageId: data.messageId,
          emoji: data.emoji,
          userId,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
} 