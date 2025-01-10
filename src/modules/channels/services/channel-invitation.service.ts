import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis.service';
import { Channel, ChannelType, MemberRole, InvitationStatus, Prisma } from '@prisma/client';
import { CreateChannelInvitationDto, ChannelInvitationResponseDto } from './dto/channel-invitation.dto';
import { ChannelInvitationGateway } from '../gateways/channel-invitation.gateway';

@Injectable()
export class ChannelInvitationService {
  private readonly logger = new Logger(ChannelInvitationService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: RedisCacheService,
    private invitationGateway: ChannelInvitationGateway,
  ) {}

  private async validateInvitationPermissions(channelId: string, inviterId: string): Promise<void> {
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: inviterId,
        }
      },
      include: {
        channel: true,
      }
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this channel');
    }

    if (member.channel.type !== ChannelType.PRIVATE) {
      throw new BadRequestException('Invitations are only for private channels');
    }

    if (member.role === MemberRole.MEMBER) {
      throw new ForbiddenException('Only admins and owners can invite users');
    }
  }

  async createInvitation(
    channelId: string, 
    inviterId: string, 
    dto: CreateChannelInvitationDto
  ): Promise<ChannelInvitationResponseDto> {
    // Validate permissions
    await this.validateInvitationPermissions(channelId, inviterId);

    // Check if user is already a member
    const existingMember = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: dto.userId,
        }
      }
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this channel');
    }

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.channelInvitation.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: dto.userId,
        }
      }
    });

    if (existingInvitation && existingInvitation.status === InvitationStatus.PENDING) {
      throw new BadRequestException('User already has a pending invitation');
    }

    try {
      // Create invitation with 7 day expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await this.prisma.channelInvitation.create({
        data: {
          channelId,
          userId: dto.userId,
          inviterId,
          role: dto.role || MemberRole.MEMBER,
          expiresAt,
        }
      });

      // Emit WebSocket event
      await this.invitationGateway.emitInvitationReceived(
        dto.userId,
        channelId,
        inviterId,
        invitation.role
      );

      return {
        success: true,
        channelId: invitation.channelId,
        userId: invitation.userId,
        role: invitation.role,
      };
    } catch (error) {
      this.logger.error('Failed to create invitation:', error);
      throw error;
    }
  }

  async acceptInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.prisma.channelInvitation.findUnique({
      where: { id: invitationId },
      include: { channel: true }
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.userId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    try {
      await this.prisma.$transaction(async (prisma) => {
        // Update invitation status
        await prisma.channelInvitation.update({
          where: { id: invitationId },
          data: { status: InvitationStatus.ACCEPTED }
        });

        // Add user to channel
        await prisma.channelMember.create({
          data: {
            channelId: invitation.channelId,
            userId,
            role: invitation.role
          }
        });

        // Update channel member count
        await prisma.channel.update({
          where: { id: invitation.channelId },
          data: { memberCount: { increment: 1 } }
        });
      });

      // Emit WebSocket event
      await this.invitationGateway.emitInvitationAccepted(
        invitation.channelId,
        userId
      );

      // Invalidate relevant caches
      await Promise.all([
        this.cacheService.invalidateChannelMembership(userId, invitation.channelId),
        this.cacheService.invalidateChannelList(userId),
        this.cacheService.invalidateChannelActivity(invitation.channelId)
      ]);
    } catch (error) {
      this.logger.error('Failed to accept invitation:', error);
      throw error;
    }
  }

  async rejectInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.prisma.channelInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.userId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    await this.prisma.channelInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REJECTED }
    });

    // Emit WebSocket event
    await this.invitationGateway.emitInvitationRejected(
      invitation.channelId,
      userId
    );
  }

  async getPendingInvitations(userId: string) {
    return this.prisma.channelInvitation.findMany({
      where: {
        userId,
        status: InvitationStatus.PENDING,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            description: true,
            memberCount: true,
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          }
        }
      }
    });
  }

  async handleExpiredInvitations(): Promise<void> {
    const now = new Date();
    const expiredInvitations = await this.prisma.channelInvitation.findMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: {
          lt: now
        }
      }
    });

    for (const invitation of expiredInvitations) {
      await this.prisma.channelInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED }
      });

      // Emit WebSocket event
      await this.invitationGateway.emitInvitationExpired(
        invitation.channelId,
        invitation.userId
      );
    }
  }
} 