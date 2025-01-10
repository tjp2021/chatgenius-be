import { Controller, Get, Post, Body, Param, Delete, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { User } from '../../shared/decorators/user.decorator';
import { MessageMapper } from './mappers/message.mapper';

@Controller('messages')
@UseGuards(ClerkGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  async create(@User() userId: string, @Body() dto: CreateMessageDto) {
    const message = await this.messageService.create(userId, dto);
    return MessageMapper.toResponse(message);
  }

  @Get('channel/:channelId')
  async findAll(@Param('channelId') channelId: string) {
    const messages = await this.messageService.findAll(channelId);
    return messages.map(message => MessageMapper.toResponse(message));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const message = await this.messageService.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return MessageMapper.toResponse(message);
  }

  @Delete(':id')
  async delete(@User() userId: string, @Param('id') id: string) {
    try {
      await this.messageService.delete(id, userId);
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Message not found');
      }
      throw new ForbiddenException('Cannot delete message');
    }
  }
} 