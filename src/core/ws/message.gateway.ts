import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from '../message/message.service';
import { MessageMapper } from '../message/mappers/message.mapper';
import { UseGuards } from '@nestjs/common';
import { WsGuard } from '../auth/ws.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
@UseGuards(WsGuard)
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly messageService: MessageService) {}

  async handleConnection(client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect();
      return;
    }
    
    // Join user's personal room
    client.join(`user:${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      client.leave(`user:${userId}`);
    }
  }

  @SubscribeMessage('joinChannel')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody('channelId') channelId: string,
  ) {
    client.join(`channel:${channelId}`);
  }

  @SubscribeMessage('leaveChannel')
  async handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody('channelId') channelId: string,
  ) {
    client.leave(`channel:${channelId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string; channelId: string },
  ) {
    const userId = client.data.userId;
    const message = await this.messageService.create(userId, {
      content: data.content,
      channelId: data.channelId,
    });

    const messageResponse = MessageMapper.toResponse(message);
    this.server.to(`channel:${data.channelId}`).emit('newMessage', messageResponse);
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; channelId: string },
  ) {
    const userId = client.data.userId;
    try {
      await this.messageService.delete(data.messageId, userId);
      this.server.to(`channel:${data.channelId}`).emit('messageDeleted', {
        messageId: data.messageId,
        channelId: data.channelId,
      });
    } catch (error) {
      client.emit('error', {
        message: 'Failed to delete message',
        code: error.code,
      });
    }
  }
} 