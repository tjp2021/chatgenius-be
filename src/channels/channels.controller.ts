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
  create(@User() userId: string, @Body() dto: CreateChannelDto) {
    return this.channelsService.create(userId, dto);
  }

  @Get()
  findAll(
    @User() userId: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'memberCount' | 'messages' | 'createdAt' | 'name' | 'lastActivity',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('type') type?: ChannelType,
  ) {
    return this.channelsService.findAll(userId, { search, sortBy, sortOrder, type });
  }

  @Get(':id')
  findOne(@User() userId: string, @Param('id') id: string) {
    return this.channelsService.findOne(userId, id);
  }

  @Post(':id/join')
  join(@User() userId: string, @Param('id') id: string) {
    return this.channelsService.join(userId, id);
  }

  @Delete(':id/leave')
  leave(@User() userId: string, @Param('id') id: string) {
    return this.channelsService.leave(userId, id);
  }

  @Post(':id/read')
  async markAsRead(@User() userId: string, @Param('id') id: string) {
    await this.channelsService.markChannelAsRead(userId, id);
    return { success: true };
  }

  @Get(':id/unread')
  async getUnreadCount(@User() userId: string, @Param('id') id: string) {
    const count = await this.channelsService.getUnreadCount(userId, id);
    return { count };
  }

  @Get(':id/activity')
  async getActivity(@Param('id') id: string) {
    return this.channelsService.getChannelActivity(id);
  }
}