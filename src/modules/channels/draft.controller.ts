import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DraftService } from './draft.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { UserId } from '../decorators/user-id.decorator';

@Controller('channels/:channelId/draft')
@UseGuards(ClerkGuard)
export class DraftController {
  constructor(private draftService: DraftService) {}

  @Post()
  async saveDraft(
    @UserId() userId: string,
    @Param('channelId') channelId: string,
    @Body() dto: SaveDraftDto,
  ) {
    return this.draftService.saveDraft(userId, channelId, dto);
  }

  @Get()
  async getDraft(
    @UserId() userId: string,
    @Param('channelId') channelId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.draftService.getDraft(userId, channelId, deviceId);
  }

  @Delete()
  async deleteDraft(
    @UserId() userId: string,
    @Param('channelId') channelId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    await this.draftService.deleteDraft(userId, channelId, deviceId);
    return { success: true };
  }
} 