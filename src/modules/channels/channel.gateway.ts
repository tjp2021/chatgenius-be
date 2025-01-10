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
    @MessageBody() payload: CreateChannelDto & { memberIds?: string[] } & { data?: any },
  ) {
    const timestamp = new Date().toISOString();
    console.log('=============== GATEWAY CREATE START ===============');
    console.log('STEP 1: Raw Payload:', {
      payload,
      type: typeof payload,
      keys: Object.keys(payload)
    });

    try {
      if (!this.validateClient(client)) {
        console.error(`[${timestamp}] ❌ Client validation failed`);
        return this.error('Unauthorized');
      }

      console.log('STEP 2: Checking payload structure:', {
        hasDataProp: 'data' in payload,
        dataType: payload.data ? typeof payload.data : 'no data prop',
        memberIdsInPayload: 'memberIds' in payload,
        memberIdsInData: payload.data && 'memberIds' in payload.data,
        payloadMemberIds: payload.memberIds,
        dataMemberIds: payload.data?.memberIds
      });

      // Extract memberIds from the correct location
      let memberIds: string[] = [];
      if ('memberIds' in payload) {
        memberIds = payload.memberIds || [];
      } else if (payload.data && 'memberIds' in payload.data) {
        memberIds = payload.data.memberIds || [];
      }

      console.log('STEP 3: Extracted memberIds:', { memberIds });
      
      // Create clean payload without memberIds
      const cleanPayload: CreateChannelDto = {
        name: payload.name || payload.data?.name,
        type: payload.type || payload.data?.type,
        description: payload.description || payload.data?.description || "",
        ...(payload.targetUserId && { targetUserId: payload.targetUserId })
      };

      console.log('STEP 4: Final data for service:', {
        cleanPayload,
        memberIds
      });

      const channel = await this.channelService.createChannel(
        client.userId,
        cleanPayload,
        memberIds
      );

      console.log('STEP 5: Service Response:', {
        channelId: channel.id,
        type: channel.type,
        memberCount: channel.memberCount
      });
      console.log('=============== GATEWAY CREATE END ===============');

      return this.success(channel);
    } catch (error) {
      console.error('STEP X: Error in gateway:', {
        error: error.message,
        stack: error.stack,
        payload
      });
      console.log('=============== GATEWAY CREATE ERROR ===============');
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
    @MessageBody() data: { channelId: string; shouldDelete?: boolean },
  ) {
    try {
      await this.channelService.leaveChannel(this.getClientUserId(client), data.channelId, data.shouldDelete);
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