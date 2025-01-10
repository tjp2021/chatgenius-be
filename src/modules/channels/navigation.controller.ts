import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { NavigationService } from './services/navigation.service';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { UserId } from '../../shared/decorators/user-id.decorator';
import { NavigationState, TransitionResult } from './types/navigation.types';

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