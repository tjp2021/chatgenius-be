import { Controller, Post, Delete, Body, Param, Get, UseGuards, Req, Logger, InternalServerErrorException } from '@nestjs/common';
import { ReactionsService } from '../services/reactions.service';
import { CreateMessageReactionDto, DeleteMessageReactionDto } from '../dto/message-reaction.dto';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';

@Controller('messages')
@UseGuards(ClerkAuthGuard)
export class ReactionsController {
  private readonly logger = new Logger(ReactionsController.name);

  constructor(private readonly reactionsService: ReactionsService) {}

  @Post(':messageId/reactions')
  async addReaction(
    @Param('messageId') messageId: string,
    @Body() createReactionDto: CreateMessageReactionDto,
    @Req() req: any,
  ) {
    try {
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }

      createReactionDto.messageId = messageId;
      return await this.reactionsService.addReaction(req.auth.userId, createReactionDto);
    } catch (error) {
      this.logger.error(`Error adding reaction: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Delete(':messageId/reactions')
  async removeReaction(
    @Param('messageId') messageId: string,
    @Body() deleteReactionDto: DeleteMessageReactionDto,
    @Req() req: any,
  ) {
    try {
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }

      deleteReactionDto.messageId = messageId;
      await this.reactionsService.removeReaction(req.auth.userId, deleteReactionDto);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error removing reaction: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get(':messageId/reactions')
  async getReactions(
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    try {
      if (!req.auth?.userId) {
        throw new Error('User ID not found in request');
      }

      return await this.reactionsService.getReactions(messageId, req.auth.userId);
    } catch (error) {
      this.logger.error(`Error getting reactions: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
} 