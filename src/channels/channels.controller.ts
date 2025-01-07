import { Controller, Get, Post, Body, Param, Query, Delete, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ChannelType } from '@prisma/client';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  create(@User() user: { id: string }, @Body() dto: CreateChannelDto) {
    return this.channelsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @User() user: { id: string },
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'memberCount' | 'messages' | 'createdAt' | 'name' | 'lastActivity',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('type') type?: ChannelType,
  ) {
    return this.channelsService.findAll(user.id, { search, sortBy, sortOrder, type });
  }

  @Get(':id')
  findOne(@User() user: { id: string }, @Param('id') id: string) {
    return this.channelsService.findOne(user.id, id);
  }

  @Post(':id/join')
  join(@User() user: { id: string }, @Param('id') id: string) {
    return this.channelsService.join(user.id, id);
  }

  @Delete(':id/leave')
  leave(@User() user: { id: string }, @Param('id') id: string) {
    return this.channelsService.leave(user.id, id);
  }

  @Post(':id/read')
  async markAsRead(@User() user: { id: string }, @Param('id') id: string) {
    await this.channelsService.markChannelAsRead(user.id, id);
    return { success: true };
  }

  @Get(':id/unread')
  async getUnreadCount(@User() user: { id: string }, @Param('id') id: string) {
    const count = await this.channelsService.getUnreadCount(user.id, id);
    return { count };
  }

  @Get(':id/activity')
  async getActivity(@Param('id') id: string) {
    return this.channelsService.getChannelActivity(id);
  }
}