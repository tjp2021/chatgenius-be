import { Controller, Get, Post, Body, Param, Delete, Put, Query, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('messages')
@UseGuards(ClerkGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('channel/:channelId')
  findMessages(
    @User('id') userId: string,
    @Param('channelId') channelId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messageService.findMessages(channelId, userId, cursor);
  }

  @Get(':messageId/replies')
  findReplies(
    @User('id') userId: string,
    @Param('messageId') messageId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messageService.findReplies(messageId, userId, cursor);
  }

  @Post()
  create(@User('id') userId: string, @Body() createMessageDto: CreateMessageDto) {
    return this.messageService.createMessage(
      createMessageDto.channelId,
      userId,
      createMessageDto,
    );
  }

  @Put(':id')
  update(
    @User('id') userId: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.messageService.updateMessage(id, userId, content);
  }

  @Delete(':id')
  delete(@User('id') userId: string, @Param('id') id: string) {
    return this.messageService.deleteMessage(id, userId);
  }
} 