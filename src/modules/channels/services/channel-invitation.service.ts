import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisCacheService } from '../../../core/cache/redis.service';
import { CreateChannelInvitationDto } from '../dto/channel-invitation.dto';
import { MemberRole } from '../channel.types';

@Injectable()
export class ChannelInvitationService {
  private readonly logger = new Logger(ChannelInvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async createInvitation(data: { 
    channelId: string; 
    inviterId: string; 
    inviteeId: string; 
  }) {
    // Check if user has permission to invite
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: data.channelId,
          userId: data.inviterId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException('No permission to invite users');
    }

    // Create invitation
    const invitation = await this.prisma.channelInvitation.create({
      data: {
        channelId: data.channelId,
        inviterId: data.inviterId,
        inviteeId: data.inviteeId,
        status: 'PENDING',
      },
      include: {
        channel: true,
        inviter: true,
      },
    });

    return {
      success: true,
      userId: data.inviteeId,
      role: 'MEMBER' as MemberRole,
      channel: invitation.channel,
      inviter: invitation.inviter
    };
  }

  async acceptInvitation(invitationId: string) {
    const invitation = await this.prisma.channelInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.prisma.channelInvitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED' },
    });
  }

  async rejectInvitation(invitationId: string) {
    const invitation = await this.prisma.channelInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.prisma.channelInvitation.update({
      where: { id: invitationId },
      data: { status: 'REJECTED' },
    });
  }

  async getPendingInvitations(userId: string) {
    return this.prisma.channelInvitation.findMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
      },
      include: {
        channel: true,
        inviter: true,
      },
    });
  }
} 