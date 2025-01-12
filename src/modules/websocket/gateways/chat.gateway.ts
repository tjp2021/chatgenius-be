import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ReactionsService } from '../../messages/services/reactions.service';
import { PrismaService } from '../../../lib/prisma.service';
import { CreateMessageReactionDto, DeleteMessageReactionDto } from '../../messages/dto/message-reaction.dto';

interface ReactionPayload {
  messageId: string;
  type: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@UseGuards(WsAuthGuard)
export class ChatGateway {
  constructor(
    private readonly reactionsService: ReactionsService,
    private readonly prisma: PrismaService,
  ) {}

  @SubscribeMessage('reaction:add')
  async handleReactionAdded(
    @MessageBody() data: ReactionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Create DTO from payload
      const dto: CreateMessageReactionDto = {
        type: data.type
      };

      // Add reaction
      const reaction = await this.reactionsService.addReaction(userId, data.messageId, dto);

      // Get channel ID for broadcasting
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { channelId: true },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Broadcast to channel
      client.to(message.channelId).emit('reaction:added', {
        messageId: data.messageId,
        reaction,
      });

      return { success: true, data: reaction };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('reaction:remove')
  async handleReactionRemoved(
    @MessageBody() data: ReactionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Create DTO from payload
      const dto: DeleteMessageReactionDto = {
        type: data.type
      };

      // Remove reaction
      await this.reactionsService.removeReaction(userId, data.messageId, dto);

      // Get channel ID for broadcasting
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { channelId: true },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Broadcast to channel
      client.to(message.channelId).emit('reaction:removed', {
        messageId: data.messageId,
        userId,
        type: data.type,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
} 