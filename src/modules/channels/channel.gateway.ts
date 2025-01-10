import { SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { BaseGateway } from '../../core/ws/base.gateway';
import { EventService } from '../../core/events/event.service';
import { ChannelService } from './channel.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';
import { CreateChannelDto, UpdateChannelDto, MemberRole } from './channel.types';

@Injectable()
export class ChannelGateway extends BaseGateway {
  constructor(
    protected readonly eventService: EventService,
    private readonly channelService: ChannelService,
  ) {
    super(eventService);
  }

  @SubscribeMessage('createChannel')
  async handleCreateChannel(
    client: AuthenticatedSocket,
    @MessageBody() payload: CreateChannelDto,
  ) {
    try {
      const channel = await this.channelService.createChannel(this.getClientUserId(client), payload);
      return this.success(channel);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('updateChannel')
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

  @SubscribeMessage('joinChannel')
  async handleJoinChannel(
    client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      await this.channelService.joinChannel(this.getClientUserId(client), data.channelId);
      this.eventService.subscribe(data.channelId, client.id, this.getClientUserId(client));
      client.join(`channel:${data.channelId}`);
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('leaveChannel')
  async handleLeaveChannel(
    client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      await this.channelService.leaveChannel(this.getClientUserId(client), data.channelId);
      this.eventService.unsubscribe(data.channelId, client.id, this.getClientUserId(client));
      client.leave(`channel:${data.channelId}`);
      return this.success(true);
    } catch (error) {
      return this.error(error.message);
    }
  }

  @SubscribeMessage('updateMemberRole')
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