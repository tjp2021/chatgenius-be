import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { DraftService } from '../channels/draft.service';
import { ChannelsService } from '../channels/channels.service';
import { DraftSyncDto } from '../channels/dto/draft-sync.dto';
import { SaveDraftDto } from '../channels/dto/save-draft.dto';
import { Logger } from '@nestjs/common';
import { ScrollPositionDto } from '../channels/dto/scroll-position.dto';
import { MetadataUpdateDto } from '../channels/dto/metadata-update.dto';

@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL!, process.env.SOCKET_URL!],
    credentials: true
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private prisma: PrismaService,
    private draftService: DraftService,
    private channelsService: ChannelsService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    // Join user's room
    client.join(`user:${userId}`);

    // Update online status
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true },
    });

    // Notify others
    this.server.emit('presence:update', { userId, isOnline: true });
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    // Update online status
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false },
    });

    // Notify others
    this.server.emit('presence:update', { userId, isOnline: false });
  }

  // Channel events
  async emitChannelUpdate(channelId: string) {
    this.server.emit('channel:update', channelId);
  }

  async emitMemberCountUpdate(channelId: string) {
    const count = await this.prisma.channelMember.count({
      where: { channelId }
    });
    this.server.emit('channel:member_count', { channelId, count });
  }

  @SubscribeMessage('channel:join')
  async handleChannelJoin(client: Socket, channelId: string) {
    const userId = client.handshake.auth.userId;
    if (!userId) return;

    client.join(`channel:${channelId}`);
    await this.emitMemberCountUpdate(channelId);
  }

  @SubscribeMessage('channel:leave')
  async handleChannelLeave(client: Socket, payload: { channelId: string; shouldDelete?: boolean }) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) throw new WsException('Unauthorized');

      const { channelId, shouldDelete } = payload;

      // Get channel membership to check if user is owner
      const membership = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: channelId,
            userId: userId
          },
        },
        include: {
          channel: {
            select: {
              name: true
            }
          }
        }
      });

      if (!membership) {
        throw new WsException('Not a member of this channel');
      }

      // Process leave/delete through channels service
      await this.channelsService.leave(userId, channelId, shouldDelete);

      // Remove socket from channel room
      client.leave(`channel:${channelId}`);

      if (shouldDelete) {
        // Notify all channel members about deletion
        this.server.to(`channel:${channelId}`).emit('channel:deleted', { 
          channelId,
          channelName: membership.channel.name
        });
      } else {
        // Notify remaining members about user leaving
        this.server.to(`channel:${channelId}`).emit('channel:member_left', {
          channelId,
          userId,
          userName: client.handshake.auth.userName || 'Unknown User'
        });
      }

      // Update member count
      await this.emitMemberCountUpdate(channelId);

    } catch (error) {
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('draft:sync')
  async handleDraftSync(client: Socket, payload: DraftSyncDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) throw new WsException('Unauthorized');

      // Verify the user is a member of the channel
      const membership = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: payload.channelId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new WsException('Not a member of this channel');
      }

      // Save the draft
      const draft = await this.draftService.saveDraft(userId, payload.channelId, {
        content: payload.content,
        deviceId: payload.deviceId,
      });

      // Emit to all user's devices except the sender
      client.broadcast
        .to(`user:${userId}`)
        .emit('draft:synced', {
          ...draft,
          timestamp: payload.timestamp,
        });

    } catch (error) {
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('scroll:sync')
  async handleScrollSync(client: Socket, payload: ScrollPositionDto) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) throw new WsException('Unauthorized');
      if (userId !== payload.userId) throw new WsException('Invalid user ID');

      // Verify channel membership
      const membership = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: payload.channelId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new WsException('Not a member of this channel');
      }

      // Emit to all user's devices except the sender
      client.broadcast
        .to(`user:${userId}`)
        .emit('scroll:synced', {
          channelId: payload.channelId,
          position: payload.position,
          timestamp: payload.timestamp,
        });

    } catch (error) {
      this.handleError(client, error);
    }
  }

  async emitMetadataUpdate(channelId: string, updates: Partial<MetadataUpdateDto>) {
    this.server.to(`channel:${channelId}`).emit('channel:metadata', {
      ...updates,
      channelId,
      timestamp: Date.now(),
    });
  }

  // Helper method to emit basic metadata updates
  async emitBasicMetadataUpdate(
    channelId: string,
    memberCount?: number,
    unreadCount?: number,
    hasUnreadMentions?: boolean,
  ) {
    await this.emitMetadataUpdate(channelId, {
      basic: {
        memberCount,
        unreadCount,
        hasUnreadMentions,
      },
    });
  }

  // Helper method to emit detailed metadata updates
  async emitDetailedMetadataUpdate(
    channelId: string,
    updates: MetadataUpdateDto['detailed'],
  ) {
    await this.emitMetadataUpdate(channelId, {
      detailed: updates,
    });
  }

  @SubscribeMessage('channel:leave:check')
  async handleChannelLeaveCheck(client: Socket, payload: { channelId: string }): Promise<any> {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) throw new WsException('Unauthorized');

      const { channelId } = payload;

      // Check channel membership
      const membership = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: channelId,
            userId: userId
          },
        }
      });

      if (!membership) {
        throw new WsException('Not a member of this channel');
      }

      // If we get here, the user is a member
      return { success: true };

    } catch (error) {
      this.handleError(client, error);
      // Re-throw the error so the client gets it
      throw error;
    }
  }

  private handleError(client: Socket, error: any) {
    const errorResponse = {
      status: 'error',
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR'
    };
    
    client.emit('error', errorResponse);
    this.logger.error(error);
  }
}