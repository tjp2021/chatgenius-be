import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { User } from '../../shared/decorators/user.decorator';
import { CreateChannelDto, UpdateChannelDto, ChannelQuery } from './channel.types';
import { Channel } from '../../core/events/event.types';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Post()
  async createChannel(
    @User('id') userId: string,
    @Body() data: CreateChannelDto,
  ): Promise<Channel> {
    return this.channelService.createChannel(userId, data);
  }

  @Put(':id')
  async updateChannel(
    @User('id') userId: string,
    @Param('id') channelId: string,
    @Body() data: UpdateChannelDto,
  ): Promise<Channel> {
    return this.channelService.updateChannel(userId, channelId, data);
  }

  @Delete(':id')
  async deleteChannel(
    @User('id') userId: string,
    @Param('id') channelId: string,
  ): Promise<void> {
    await this.channelService.deleteChannel(userId, channelId);
  }

  @Post(':id/join')
  async joinChannel(
    @User('id') userId: string,
    @Param('id') channelId: string,
  ): Promise<void> {
    await this.channelService.joinChannel(userId, channelId);
  }

  @Post(':id/leave')
  async leaveChannel(
    @User('id') userId: string,
    @Param('id') channelId: string,
  ): Promise<void> {
    await this.channelService.leaveChannel(userId, channelId);
  }

  @Get()
  async getChannels(
    @User('id') userId: string,
    @Query() query: ChannelQuery,
  ): Promise<Channel[]> {
    return this.channelService.getChannels(userId, query);
  }

  @Get(':id')
  async getChannel(
    @User('id') userId: string,
    @Param('id') channelId: string,
  ): Promise<Channel> {
    return this.channelService.getChannel(userId, channelId);
  }

  @Get(':id/members')
  async getMembers(@Param('id') channelId: string) {
    return this.channelService.getMembers(channelId);
  }
} 