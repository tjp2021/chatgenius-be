import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ChannelsService } from '../services/channels.service';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelQuery } from '../types/channel.types';
import { ClerkAuthGuard } from '@/guards/clerk-auth.guard';

@Controller('channels')
@UseGuards(ClerkAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  async getChannels(@Req() req: any, @Query() query: ChannelQuery) {
    return this.channelsService.getChannels(req.auth.userId, query);
  }

  @Get(':id')
  async getChannel(@Req() req: any, @Param('id') id: string) {
    return this.channelsService.getChannel(req.auth.userId, id);
  }

  @Post()
  async createChannel(@Req() req: any, @Body() createChannelDto: CreateChannelDto) {
    return this.channelsService.createChannel(req.auth.userId, createChannelDto);
  }

  @Put(':id')
  async updateChannel(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ) {
    return this.channelsService.updateChannel(req.auth.userId, id, updateChannelDto);
  }

  @Delete(':id')
  async deleteChannel(@Req() req: any, @Param('id') id: string) {
    return this.channelsService.deleteChannel(req.auth.userId, id);
  }

  @Delete(':id/leave')
  async leaveChannel(@Req() req: any, @Param('id') id: string) {
    return this.channelsService.removeMember(req.auth.userId, id);
  }

  @Post(':id/join')
  async joinChannel(@Req() req: any, @Param('id') id: string) {
    return this.channelsService.addMember(id, req.auth.userId, 'MEMBER');
  }
} 