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
import { BrowseService } from '../channels/browse.service';
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
    private browseService: BrowseService,
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

  // Channel update events
  async emitChannelUpdate(channelId: string, userId: string) {
    try {
      // Get updated channel data
      const channelData = await this.browseService.getJoinedChannels(userId, {});
      
      // Emit updated channel list to the specific user
      this.server.to(`user:${userId}`).emit('channels:list', {
        channels: channelData.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          _count: channel._count,
          isOwner: channel.isOwner,
          joinedAt: channel.joinedAt
        }))
      });

      // Get the updated channel for channel:updated event
      const updatedChannel = channelData.channels.find(c => c.id === channelId);
      if (updatedChannel) {
        this.server.to(`user:${userId}`).emit('channel:updated', {
          channel: updatedChannel,
          timestamp: new Date().toISOString()
        });
      }

      // Emit member count update to all users in the channel
      const activity = await this.channelsService.getChannelActivity(channelId);
      this.server.to(`channel:${channelId}`).emit('channel:member_count', {
        channelId,
        count: activity.memberCount,
        timestamp: new Date().toISOString()
      });

      // Get and emit updated public channels list
      const publicChannels = await this.browseService.getPublicChannels(userId, { 
        search: '', 
        sortBy: 'memberCount', 
        sortOrder: 'desc' 
      });
      this.server.emit('public:channels', {
        channels: publicChannels.channels,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error(`Failed to emit channel update: ${error.message}`, error.stack);
    }
  }

  async emitChannelDeleted(channelId: string, channelName: string) {
    this.server.emit('channel:deleted', {
      channelId,
      channelName,
      timestamp: new Date().toISOString()
    });
  }

  async emitMemberJoined(channelId: string, userId: string, userName: string) {
    // Get full channel and membership data
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId
        }
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            memberCount: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            isOnline: true
          }
        }
      }
    });

    if (!membership) {
      this.logger.error(`Failed to emit member joined: membership not found for ${userId} in ${channelId}`);
      return;
    }

    this.server.to(`channel:${channelId}`).emit('channel:member_joined', {
      channelId: membership.channelId,
      userId: membership.userId,
      role: membership.role,
      channel: membership.channel,
      user: membership.user
    });
  }

  async emitMemberLeft(channelId: string, userId: string, userName: string) {
    this.server.to(`channel:${channelId}`).emit('channel:member_left', {
      channelId,
      userId,
      userName,
      timestamp: new Date().toISOString()
    });
  }

  @SubscribeMessage('channel:join')
  async handleChannelJoin(client: Socket, payload: { channelId: string }) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) throw new WsException('Unauthorized');

      const { channelId } = payload;

      // Join the channel through the channels service
      await this.channelsService.join(userId, channelId);

      // Join the socket room
      client.join(`channel:${channelId}`);

      // Emit member joined event
      await this.emitMemberJoined(
        channelId,
        userId,
        client.handshake.auth.userName || 'Unknown User'
      );

      // Get and emit updated public channels list to all clients
      const publicChannels = await this.browseService.getPublicChannels(userId, { 
        search: '', 
        sortBy: 'memberCount', 
        sortOrder: 'desc' 
      });
      this.server.emit('public:channels', {
        channels: publicChannels.channels,
        timestamp: new Date().toISOString()
      });

      // Get and emit updated joined channels list to the user
      const joinedChannels = await this.browseService.getJoinedChannels(userId, {});
      this.server.to(`user:${userId}`).emit('channels:list', {
        channels: joinedChannels.channels,
        timestamp: new Date().toISOString()
      });

      // Emit member count update to all users in the channel
      const activity = await this.channelsService.getChannelActivity(channelId);
      this.server.to(`channel:${channelId}`).emit('channel:member_count', {
        channelId,
        count: activity.memberCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.handleError(client, error);
    }
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
            channelId,
            userId
          }
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
        await this.emitChannelDeleted(channelId, membership.channel.name);
      } else {
        await this.emitMemberLeft(
          channelId,
          userId,
          client.handshake.auth.userName || 'Unknown User'
        );
      }

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

  @SubscribeMessage('channels:list')
  async handleChannelsList(client: Socket) {
    try {
      const userId = client.handshake.auth.userId;
      if (!userId) throw new WsException('Unauthorized');

      // Use BrowseService to get only joined channels
      const joinedChannels = await this.browseService.getJoinedChannels(userId, {});
      
      // Return only the necessary data for the sidebar
      return {
        channels: joinedChannels.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          _count: channel._count,
          isOwner: channel.isOwner,
          joinedAt: channel.joinedAt
        }))
      };
    } catch (error) {
      this.handleError(client, error);
      throw error; // Re-throw to ensure client gets the error
    }
  }
}