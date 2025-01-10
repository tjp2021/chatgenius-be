import { Controller, Get, Param, Req, Logger } from '@nestjs/common';
import { MessageService } from './message.service';
import { Request } from 'express';

@Controller('messages')
export class MessageController {
  private readonly logger = new Logger(MessageController.name);

  constructor(private readonly messageService: MessageService) {}

  @Get('channel/:channelId')
  async getChannelMessages(@Param('channelId') channelId: string, @Req() request: Request) {
    this.logger.debug(`Request headers: ${JSON.stringify(request.headers)}`);
    this.logger.log(`Fetching messages for channel: ${channelId}`);
    
    try {
      const messages = await this.messageService.findByChannel(channelId);
      this.logger.log(`Successfully retrieved ${messages.length} messages for channel ${channelId}`);
      return messages;
    } catch (error) {
      this.logger.error(`Error fetching messages for channel ${channelId}:`, error);
      this.logger.error(`Stack trace:`, error.stack);
      throw error;
    }
  }
} 