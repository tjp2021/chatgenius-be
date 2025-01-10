import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { User } from '../../shared/decorators/user.decorator';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
  ) {}

  @Post()
  create(@User() userId: string, @Body() createChannelDto: CreateChannelDto) {
    return this.channelsService.create(userId, createChannelDto);
  }

  @Get()
  findAll(@User() userId: string) {
    return this.channelsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channelsService.findOne(id);
  }

  @Delete(':id')
  remove(@User() userId: string, @Param('id') id: string) {
    return this.channelsService.remove(userId, id);
  }
}