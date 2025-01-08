import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { UserId } from '../decorators/user-id.decorator';
import { NavigationState, TransitionResult } from './types';

@Controller('channels/navigation')
@UseGuards(ClerkGuard)
export class NavigationController {
  constructor(private navigationService: NavigationService) {}

  @Get('default')
  async getDefaultState(@UserId() userId: string): Promise<NavigationState> {
    return this.navigationService.getDefaultNavigationState(userId);
  }

  @Get('next/:channelId')
  async handleTransition(
    @UserId() userId: string,
    @Param('channelId') channelId: string,
  ): Promise<TransitionResult> {
    return this.navigationService.handleChannelTransition(userId, channelId);
  }
} 