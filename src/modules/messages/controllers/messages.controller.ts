import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, Logger, InternalServerErrorException } from '@nestjs/common';
import { MessagesService } from '../services/messages.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';

@Controller('messages')
@UseGuards(ClerkAuthGuard)
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);
  
  constructor(private readonly messagesService: MessagesService) {}

  @Get('channel/:channelId')
  async getMessages(
    @Param('channelId') channelId: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    try {
      this.logger.log(`Getting messages for channel ${channelId} by user ${req.auth?.userId}`);
      
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }
      
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      
      return await this.messagesService.getMessages(channelId, req.auth.userId, parsedLimit, cursor);
    } catch (error) {
      this.logger.error(`Error getting messages: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get(':id')
  async getMessage(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    try {
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }
      
      return await this.messagesService.getMessage(id, req.auth.userId);
    } catch (error) {
      this.logger.error(`Error getting message: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post()
  async createMessage(
    @Req() req: any,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    try {
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }
      
      return await this.messagesService.createMessage(req.auth.userId, createMessageDto);
    } catch (error) {
      this.logger.error(`Error creating message: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Put(':id')
  async updateMessage(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    try {
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }
      
      return await this.messagesService.updateMessage(id, req.auth.userId, updateMessageDto);
    } catch (error) {
      this.logger.error(`Error updating message: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Delete(':id')
  async deleteMessage(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    try {
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }
      
      return await this.messagesService.deleteMessage(id, req.auth.userId);
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Get messages in a thread with pagination
   */
  @Get(':threadId/thread')
  async getThreadMessages(
    @Param('threadId') threadId: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    try {
      this.logger.log(`Getting thread messages for thread ${threadId} by user ${req.auth?.userId}`);
      
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }
      
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      
      return await this.messagesService.getThreadMessages(threadId, req.auth.userId, parsedLimit, cursor);
    } catch (error) {
      this.logger.error(`Error getting thread messages: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Get thread details including starter message and metadata
   */
  @Get(':threadId/thread/details')
  async getThreadDetails(
    @Param('threadId') threadId: string,
    @Req() req: any,
  ) {
    try {
      this.logger.log(`Getting thread details for thread ${threadId} by user ${req.auth?.userId}`);
      
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }
      
      return await this.messagesService.getThreadDetails(threadId, req.auth.userId);
    } catch (error) {
      this.logger.error(`Error getting thread details: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
} 