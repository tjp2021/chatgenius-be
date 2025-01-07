import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('messages')
@UseGuards(ClerkGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  create(@User() userId: string, @Body() dto: CreateMessageDto) {
    return this.messageService.create(userId, dto);
  }

  @Get('channel/:channelId')
  findAll(
    @Param('channelId') channelId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messageService.findAll(channelId, cursor);
  }

  @Get(':messageId/replies')
  findReplies(@Param('messageId') messageId: string) {
    return this.messageService.findReplies(messageId);
  }
} 