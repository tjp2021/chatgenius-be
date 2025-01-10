import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';
import { ChannelInvitationService } from './channel-invitation.service';
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
    return this.invitationService.createInvitation(channelId, user.id, dto);
  }

  @Post('invitations/:invitationId/accept')
  async acceptInvitation(
    @User() user: { id: string },
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.invitationService.acceptInvitation(invitationId, user.id);
  }

  @Post('invitations/:invitationId/reject')
  async rejectInvitation(
    @User() user: { id: string },
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.invitationService.rejectInvitation(invitationId, user.id);
  }

  @Get('invitations/pending')
  async getPendingInvitations(@User() user: { id: string }) {
    return this.invitationService.getPendingInvitations(user.id);
  }
} 