import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get()
  listChannels(@User('id') userId: string) {
    return this.channelsService.listChannels(userId);
  }

  @Post()
  createChannel(
    @User('id') userId: string,
    @Body() data: { name: string; type: 'PUBLIC' | 'PRIVATE' | 'DM' }
  ) {
    return this.channelsService.createChannel(userId, data);
  }
} 