import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DraftService } from './services/draft.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { UserId } from '../../shared/decorators/user-id.decorator';
import { User } from '../../shared/decorators/user.decorator';

@Controller('channels/:channelId/draft')
@UseGuards(ClerkGuard)
export class DraftController {
  constructor(private draftService: DraftService) {}

  @Post(':channelId')
  async saveDraft(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Body() dto: SaveDraftDto
  ) {
    return this.draftService.saveDraft({
      userId: user.id,
      channelId,
      deviceId: dto.deviceId,
      content: dto.content
    });
  }

  @Get(':channelId')
  async getDraft(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Query('deviceId') deviceId?: string
  ) {
    return this.draftService.getDraft({
      userId: user.id,
      channelId,
      deviceId: deviceId || ''
    });
  }

  @Delete(':channelId')
  async deleteDraft(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Query('deviceId') deviceId?: string
  ) {
    await this.draftService.deleteDraft({
      userId: user.id,
      channelId,
      deviceId: deviceId || ''
    });
  }
} 