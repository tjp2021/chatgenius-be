import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  create(@User('id') userId: string, @Body() createChannelDto: CreateChannelDto) {
    return this.channelsService.create(userId, createChannelDto);
  }

  @Get()
  findAll(@User('id') userId: string) {
    return this.channelsService.findAll(userId);
  }

  @Get(':id')
  findOne(@User('id') userId: string, @Param('id') id: string) {
    return this.channelsService.findOne(userId, id);
  }

  @Post(':id/join')
  join(@User('id') userId: string, @Param('id') id: string) {
    return this.channelsService.join(userId, id);
  }

  @Delete(':id/leave')
  leave(@User('id') userId: string, @Param('id') id: string) {
    return this.channelsService.leave(userId, id);
  }
}