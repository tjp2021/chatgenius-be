import { Controller, Post, Delete, Body, Param, Get, UseGuards, Req, Logger, InternalServerErrorException, ParseUUIDPipe } from '@nestjs/common';
import { Request } from 'express';
import { ReactionsService } from '../services/reactions.service';
import { CreateMessageReactionDto, DeleteMessageReactionDto } from '../dto/message-reaction.dto';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';

interface AuthenticatedRequest extends Request {
  auth: {
    userId: string;
  };
}

@Controller('messages')
@UseGuards(ClerkAuthGuard)
export class ReactionsController {
  private readonly logger = new Logger(ReactionsController.name);

  constructor(private readonly reactionsService: ReactionsService) {}

  @Post(':messageId/reactions')
  async addReaction(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() createReactionDto: CreateMessageReactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      return await this.reactionsService.addReaction(req.auth.userId, messageId, createReactionDto);
    } catch (error) {
      this.logger.error('Error adding reaction:', error);
      throw new InternalServerErrorException();
    }
  }

  @Delete(':messageId/reactions')
  async removeReaction(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() deleteReactionDto: DeleteMessageReactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      await this.reactionsService.removeReaction(req.auth.userId, messageId, deleteReactionDto);
    } catch (error) {
      this.logger.error('Error removing reaction:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get(':messageId/reactions')
  async getReactions(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      return await this.reactionsService.getReactions(req.auth.userId, messageId);
    } catch (error) {
      this.logger.error('Error getting reactions:', error);
      throw new InternalServerErrorException();
    }
  }
} 