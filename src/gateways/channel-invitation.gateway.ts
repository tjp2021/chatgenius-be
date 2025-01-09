import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelInvitationService } from '../channels/channel-invitation.service';
import { MemberRole } from '@prisma/client';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL!, process.env.SOCKET_URL!],
    credentials: true
  },
})
export class ChannelInvitationGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChannelInvitationGateway.name);

  constructor(
    private prisma: PrismaService,
    private invitationService: ChannelInvitationService,
  ) {}

  async emitInvitationReceived(
    userId: string,
    channelId: string,
    inviterId: string,
    role: MemberRole
  ) {
    try {
      const [channel, inviter] = await Promise.all([
        this.prisma.channel.findUnique({
          where: { id: channelId },
          select: {
            id: true,
            name: true,
            description: true,
            memberCount: true,
          }
        }),
        this.prisma.user.findUnique({
          where: { id: inviterId },
          select: {
            id: true,
            name: true,
            imageUrl: true,
          }
        })
      ]);

      if (!channel || !inviter) {
        this.logger.error('Failed to emit invitation: channel or inviter not found');
        return;
      }

      this.server.to(`user:${userId}`).emit('invitation:received', {
        channel,
        inviter,
        role,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to emit invitation received:', error);
    }
  }

  async emitInvitationAccepted(
    channelId: string,
    userId: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          imageUrl: true,
        }
      });

      if (!user) {
        this.logger.error('Failed to emit invitation accepted: user not found');
        return;
      }

      // Emit to all channel members
      this.server.to(`channel:${channelId}`).emit('invitation:accepted', {
        channelId,
        user,
        timestamp: new Date().toISOString()
      });

      // Emit channel update to the new member
      this.server.to(`user:${userId}`).emit('channel:joined', {
        channelId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to emit invitation accepted:', error);
    }
  }

  async emitInvitationRejected(
    channelId: string,
    userId: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
        }
      });

      if (!user) {
        this.logger.error('Failed to emit invitation rejected: user not found');
        return;
      }

      // Only emit to channel admins and owners
      const adminMembers = await this.prisma.channelMember.findMany({
        where: {
          channelId,
          role: {
            in: [MemberRole.ADMIN, MemberRole.OWNER]
          }
        },
        select: {
          userId: true
        }
      });

      // Emit to each admin individually
      adminMembers.forEach(member => {
        this.server.to(`user:${member.userId}`).emit('invitation:rejected', {
          channelId,
          user,
          timestamp: new Date().toISOString()
        });
      });
    } catch (error) {
      this.logger.error('Failed to emit invitation rejected:', error);
    }
  }

  async emitInvitationExpired(
    channelId: string,
    userId: string,
  ) {
    try {
      // Notify the invited user
      this.server.to(`user:${userId}`).emit('invitation:expired', {
        channelId,
        timestamp: new Date().toISOString()
      });

      // Notify channel admins
      const adminMembers = await this.prisma.channelMember.findMany({
        where: {
          channelId,
          role: {
            in: [MemberRole.ADMIN, MemberRole.OWNER]
          }
        },
        select: {
          userId: true
        }
      });

      adminMembers.forEach(member => {
        this.server.to(`user:${member.userId}`).emit('invitation:expired', {
          channelId,
          userId,
          timestamp: new Date().toISOString()
        });
      });
    } catch (error) {
      this.logger.error('Failed to emit invitation expired:', error);
    }
  }
} 