import { UseGuards } from '@nestjs/common';
import { SubscribeMessage } from '@nestjs/websockets';
import { WebSocketGateway } from '../../core/ws/ws.gateway';
import { AuthenticatedSocket } from '../../core/ws/ws.types';
import { CreateChannelDto, UpdateChannelDto, MemberRole } from './channel.types';
import { ChannelService } from './channel.service';
import { WsGuard } from '../../shared/guards/ws.guard';

@UseGuards(WsGuard)
export class ChannelGateway extends WebSocketGateway {
  constructor(private channelService: ChannelService) {
    super();
  }

  @SubscribeMessage('channel:create')
  async handleCreateChannel(client: AuthenticatedSocket, payload: CreateChannelDto) {
    try {
      const channel = await this.channelService.createChannel(client.userId, payload);
      return this.success(channel);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('channel:update')
  async handleUpdateChannel(client: AuthenticatedSocket, payload: UpdateChannelDto) {
    try {
      const channel = await this.channelService.updateChannel(client.userId, payload);
      return this.success(channel);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('channel:join')
  async handleJoinChannel(client: AuthenticatedSocket, channelId: string) {
    try {
      await this.channelService.joinChannel(client.userId, channelId);
      
      // Join the socket room for this channel
      client.join(`channel:${channelId}`);
      
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('channel:leave')
  async handleLeaveChannel(client: AuthenticatedSocket, channelId: string) {
    try {
      await this.channelService.leaveChannel(client.userId, channelId);
      
      // Leave the socket room
      client.leave(`channel:${channelId}`);
      
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('channel:update_role')
  async handleUpdateRole(
    client: AuthenticatedSocket, 
    payload: { channelId: string; userId: string; role: MemberRole }
  ) {
    try {
      await this.channelService.updateMemberRole(
        client.userId,
        payload.channelId,
        payload.userId,
        payload.role
      );
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  // Handle connection to join all user's channel rooms
  async handleConnection(client: AuthenticatedSocket) {
    try {
      await super.handleConnection(client);
      
      // Get user's channels and join their rooms
      const channels = await this.channelService.getUserChannels(client.userId, {});
      channels.forEach(channel => {
        client.join(`channel:${channel.id}`);
      });
    } catch (error) {
      client.disconnect();
    }
  }
} 