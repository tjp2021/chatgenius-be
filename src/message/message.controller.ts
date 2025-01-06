import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('messages')
@UseGuards(ClerkGuard)
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Get('channel/:channelId')
  getChannelMessages(
    @Param('channelId') channelId: string,
    @User('id') userId: string,
  ) {
    return this.messageService.getChannelMessages(channelId, userId);
  }

  @Post('channel/:channelId')
  createMessage(
    @Param('channelId') channelId: string,
    @User('id') userId: string,
    @Body() data: { content: string; parentId?: string }
  ) {
    return this.messageService.createMessage(channelId, userId, data);
  }
} 