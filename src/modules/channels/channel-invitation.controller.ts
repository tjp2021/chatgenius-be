import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { User } from '../../shared/decorators/user.decorator';
import { ChannelInvitationService } from './services/channel-invitation.service';
import { 
  CreateChannelInvitationDto, 
  ChannelInvitationResponseDto,
  AcceptChannelInvitationDto,
  RejectChannelInvitationDto
} from './dto/channel-invitation.dto';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelInvitationController {
  constructor(private readonly invitationService: ChannelInvitationService) {}

  @Post(':channelId/invitations')
  async createInvitation(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Body() dto: CreateChannelInvitationDto
  ): Promise<ChannelInvitationResponseDto> {
    return this.invitationService.createInvitation({
      channelId,
      inviterId: user.id,
      inviteeId: dto.inviteeId,
    });
  }

  @Post('invitations/:invitationId/accept')
  async acceptInvitation(
    @User() user: { id: string },
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.invitationService.acceptInvitation(invitationId);
  }

  @Post('invitations/:invitationId/reject')
  async rejectInvitation(
    @User() user: { id: string },
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.invitationService.rejectInvitation(invitationId);
  }

  @Get('invitations/pending')
  async getPendingInvitations(@User() user: { id: string }) {
    return this.invitationService.getPendingInvitations(user.id);
  }
} 