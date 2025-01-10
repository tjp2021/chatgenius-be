import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { CreateChannelDto, UpdateChannelDto, ChannelQuery, MemberRole } from './channel.types';
import { User } from '../../shared/decorators/user.decorator';
import { ClerkGuard } from '../../shared/guards/clerk.guard';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelController {
  constructor(private channelService: ChannelService) {}

  @Post()
  createChannel(@User() userId: string, @Body() data: CreateChannelDto) {
    return this.channelService.createChannel(userId, data);
  }

  @Put(':id')
  updateChannel(
    @User() userId: string,
    @Param('id') id: string,
    @Body() data: UpdateChannelDto
  ) {
    return this.channelService.updateChannel(userId, { ...data, id });
  }

  @Delete(':id')
  deleteChannel(@User() userId: string, @Param('id') id: string) {
    return this.channelService.deleteChannel(userId, id);
  }

  @Get('public')
  getPublicChannels(@Query() query: ChannelQuery) {
    return this.channelService.getPublicChannels(query);
  }

  @Get('me')
  getUserChannels(@User() userId: string, @Query() query: ChannelQuery) {
    return this.channelService.getUserChannels(userId, query);
  }

  @Get(':id/members')
  getChannelMembers(@Param('id') id: string) {
    return this.channelService.getChannelMembers(id);
  }

  @Post(':id/join')
  joinChannel(@User() userId: string, @Param('id') id: string) {
    return this.channelService.joinChannel(userId, id);
  }

  @Post(':id/leave')
  leaveChannel(@User() userId: string, @Param('id') id: string) {
    return this.channelService.leaveChannel(userId, id);
  }

  @Put(':id/members/:memberId/role')
  updateMemberRole(
    @User() userId: string,
    @Param('id') channelId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: MemberRole
  ) {
    return this.channelService.updateMemberRole(userId, channelId, memberId, role);
  }
} 