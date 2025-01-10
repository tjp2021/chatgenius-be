import { 
  WebSocketGateway, 
  WebSocketServer,
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, UseGuards, Logger } from '@nestjs/common';
import { WsGuard } from '../../shared/guards/ws.guard';
import { PrismaService } from '../database/prisma.service';
import { ChannelInvitationService } from '../../modules/channels/services/channel-invitation.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';

@Injectable()
@WebSocketGateway({
  namespace: 'invitations',
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
@UseGuards(WsGuard)
export class ChannelInvitationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChannelInvitationGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationService: ChannelInvitationService,
  ) {}

  async handleConnection(client: AuthenticatedSocket, ...args: any[]) {
    try {
      this.logger.debug(`Client connected: ${client.id}`);
      
      // Get user's channels
      const channels = await this.prisma.channelMember.findMany({
        where: { userId: client.userId },
        select: { channelId: true },
      });

      // Subscribe to all channels
      channels.forEach(({ channelId }) => {
        client.join(`channel:${channelId}`);
      });

      return true;
    } catch (error) {
      this.logger.error('Connection error:', error);
      return false;
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('invitation:send')
  async handleSendInvitation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string; inviteeId: string },
  ) {
    try {
      // Check if user has permission to invite
      const membership = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: data.channelId,
            userId: client.userId,
          },
        },
      });

      if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new Error('No permission to invite users');
      }

      // Create invitation
      const invitation = await this.invitationService.createInvitation({
        channelId: data.channelId,
        inviterId: client.userId,
        inviteeId: data.inviteeId,
      });

      // Notify invitee
      this.server.to(`user:${data.inviteeId}`).emit('invitation:received', invitation);

      return { success: true, invitation };
    } catch (error) {
      this.logger.error('Error sending invitation:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('invitation:respond')
  async handleInvitationResponse(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { invitationId: string; accept: boolean },
  ) {
    try {
      // Get invitation
      const invitation = await this.prisma.channelInvitation.findUnique({
        where: { id: data.invitationId },
        include: { channel: true },
      });

      if (!invitation || invitation.inviteeId !== client.userId) {
        throw new Error('Invalid invitation');
      }

      if (data.accept) {
        // Accept invitation
        await this.invitationService.acceptInvitation(data.invitationId);

        // Add member to channel
        await this.prisma.channelMember.create({
          data: {
            channelId: invitation.channelId,
            userId: client.userId,
            role: 'MEMBER',
          },
        });

        // Subscribe to channel
        client.join(`channel:${invitation.channelId}`);

        // Notify channel members
        this.server.to(`channel:${invitation.channelId}`).emit('member:joined', {
          channelId: invitation.channelId,
          userId: client.userId,
        });
      } else {
        // Reject invitation
        await this.invitationService.rejectInvitation(data.invitationId);
      }

      // Notify inviter
      this.server.to(`user:${invitation.inviterId}`).emit('invitation:response', {
        invitationId: data.invitationId,
        accepted: data.accept,
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error handling invitation response:', error);
      return { success: false, error: error.message };
    }
  }
} 