import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { UserId } from '../../shared/decorators/user-id.decorator';
import { BrowseService } from './services/browse.service';
import {
  PublicChannelsResponse,
  JoinedChannelsResponse,
  ChannelJoinResponse,
  ChannelLeaveResponse,
  ChannelMembersResponse,
  ChannelSortBy,
  SortOrder,
} from './dto/channel-browse.dto';

@Controller('channels/browse')
@UseGuards(ClerkGuard)
export class BrowseController {
  constructor(private browseService: BrowseService) {}

  @Get('public')
  async getPublicChannels(
    @UserId() userId: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: ChannelSortBy,
    @Query('sortOrder') sortOrder?: SortOrder,
  ): Promise<PublicChannelsResponse> {
    return this.browseService.getPublicChannels(userId, {
      search,
      sortBy,
      sortOrder,
    });
  }

  @Get('joined')
  async getJoinedChannels(
    @UserId() userId: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: ChannelSortBy,
    @Query('sortOrder') sortOrder?: SortOrder,
  ): Promise<JoinedChannelsResponse> {
    return this.browseService.getJoinedChannels(userId, {
      search,
      sortBy,
      sortOrder,
    });
  }

  @Get(':channelId/members')
  async getChannelMembers(
    @UserId() userId: string,
    @Param('channelId') channelId: string,
  ): Promise<ChannelMembersResponse> {
    return this.browseService.getChannelMembers(userId, channelId);
  }
} 