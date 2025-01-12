import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ChannelsService } from '../services/channels.service';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelQuery } from '../types/channel.types';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  async getChannels(@Query() query: ChannelQuery) {
    return this.channelsService.getChannels('test-user', query); // TODO: Get real user ID from auth
  }

  @Get(':id')
  async getChannel(@Param('id') id: string) {
    return this.channelsService.getChannel('test-user', id); // TODO: Get real user ID from auth
  }

  @Post()
  async createChannel(@Body() createChannelDto: CreateChannelDto) {
    return this.channelsService.createChannel('test-user', createChannelDto); // TODO: Get real user ID from auth
  }

  @Put(':id')
  async updateChannel(
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ) {
    return this.channelsService.updateChannel('test-user', id, updateChannelDto); // TODO: Get real user ID from auth
  }

  @Delete(':id')
  async deleteChannel(@Param('id') id: string) {
    return this.channelsService.deleteChannel('test-user', id); // TODO: Get real user ID from auth
  }
} 