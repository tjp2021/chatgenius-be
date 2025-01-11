import { SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { BaseGateway } from '../../core/ws/base.gateway';
import { EventService } from '../../core/events/event.service';
import { ChannelService } from './channel.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { CreateChannelDto, UpdateChannelDto, MemberRole } from './channel.types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class ChannelGateway extends BaseGateway {
  protected readonly logger = new Logger(ChannelGateway.name);

  constructor(
    protected readonly eventService: EventService,
    private readonly channelService: ChannelService,
  ) {
    super(eventService);
  }

  @SubscribeMessage('channel:create')
  async handleCreateChannel(
    client: AuthenticatedSocket,
    @MessageBody() payload: CreateChannelDto,
  ) {
    try {
      const channel = await this.channelService.createChannel(
        this.getClientUserId(client),
        payload,
        payload.memberIds
      );
      return this.success(channel);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('channel:update')
  async handleUpdateChannel(
    client: AuthenticatedSocket,
    @MessageBody() payload: UpdateChannelDto,
  ) {
    try {
      const channel = await this.channelService.updateChannel(
        this.getClientUserId(client),
        payload.channelId,
        payload
      );
      return this.success(channel);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('channel:join')
  async handleJoinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const userId = client.userId;
    if (!userId) {
      this.logger.error('No userId found on socket');
      return this.error('UNAUTHORIZED');
    }

    const { channelId } = data;

    try {
      this.logger.debug(`Join attempt for channel ${channelId} by user ${userId}`);

      // Check if channel exists and is public
      const channel = await this.channelService.getChannel(userId, channelId).catch(err => {
        if (err instanceof ForbiddenException) {
          // Ignore forbidden exception as user might not be a member yet
          return null;
        }
        throw err;
      });

      // If channel exists and user is already a member
      if (channel) {
        this.logger.debug(`User ${userId} is already a member of channel ${channelId}`);
        await this.joinChannelRoom(client, channelId);
        return this.success(channel);
      }

      // Not a member, try to join
      this.logger.debug(`Attempting to add user ${userId} to channel ${channelId}`);
      await this.channelService.joinChannel(userId, channelId);
      await this.joinChannelRoom(client, channelId);
      
      // Get updated channel data
      const updatedChannel = await this.channelService.getChannel(userId, channelId);
      
      this.logger.debug(`Successfully joined channel ${channelId}`);
      return this.success(updatedChannel);
    } catch (error) {
      this.logger.error(`Channel join failed: ${error.message}`, {
        userId,
        channelId,
        error
      });

      // Return appropriate error response
      if (error instanceof ForbiddenException) {
        return this.error('ALREADY_MEMBER');
      } else if (error instanceof NotFoundException) {
        return this.error('CHANNEL_NOT_FOUND');
      } else {
        return this.error('JOIN_FAILED');
      }
    }
  }

  // Helper method to handle socket room join
  private async joinChannelRoom(client: AuthenticatedSocket, channelId: string) {
    const userId = this.getClientUserId(client);
    
    try {
      // Subscribe to events first
      await this.eventService.subscribe(channelId, client.id, userId);
      
      // Then join the socket room
      await client.join(`channel:${channelId}`);
      
      // Emit member count update
      const channel = await this.channelService.getChannel(userId, channelId);
      await this.server.to(`channel:${channelId}`).emit('channel:member_count', {
        channelId,
        count: channel.memberCount
      });
    } catch (error) {
      this.logger.error(`Failed to join channel room: ${error.message}`, {
        userId,
        channelId,
        error
      });
      throw error; // Propagate error to main handler
    }
  }

  @SubscribeMessage('channel:leave')
  async handleLeaveChannel(
    client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string; shouldDelete?: boolean },
  ) {
    const userId = this.getClientUserId(client);
    const { channelId, shouldDelete } = data;

    try {
      await this.channelService.leaveChannel(userId, channelId, shouldDelete);
      
      // Cleanup socket room and subscriptions
      this.eventService.unsubscribe(channelId, client.id, userId);
      await client.leave(`channel:${channelId}`);
      
      // Emit member count update
      const channel = await this.channelService.getChannel(userId, channelId);
      this.server.to(`channel:${channelId}`).emit('channel:member_count', {
        channelId,
        count: channel.memberCount
      });

      return this.success(true);
    } catch (error) {
      this.logger.error(`Channel leave failed: ${error.message}`, {
        userId,
        channelId,
        error
      });

      return this.error(error.message);
    }
  }

  @SubscribeMessage('channel:member:role')
  async handleUpdateMemberRole(
    client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string; userId: string; role: MemberRole },
  ) {
    try {
      await this.channelService.updateChannel(this.getClientUserId(client), data.channelId, {
        channelId: data.channelId,
        memberRole: { userId: data.userId, role: data.role }
      });
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }
} 