import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MessagesService } from '../services/messages.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { User } from '../../../auth/decorators/user.decorator';

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('channel/:channelId')
  async getMessages(
    @Param('channelId') channelId: string,
    @User('sub') userId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagesService.getMessages(channelId, userId, limit, cursor);
  }

  @Get(':id')
  async getMessage(
    @Param('id') id: string,
    @User('sub') userId: string,
  ) {
    return this.messagesService.getMessage(id, userId);
  }

  @Post()
  async createMessage(
    @User('sub') userId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.createMessage(userId, createMessageDto);
  }

  @Put(':id')
  async updateMessage(
    @Param('id') id: string,
    @User('sub') userId: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.messagesService.updateMessage(id, userId, updateMessageDto);
  }

  @Delete(':id')
  async deleteMessage(
    @Param('id') id: string,
    @User('sub') userId: string,
  ) {
    return this.messagesService.deleteMessage(id, userId);
  }
} 