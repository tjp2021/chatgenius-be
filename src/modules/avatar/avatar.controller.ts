import { Controller, Post, Body, Get, Put, Param, BadRequestException } from '@nestjs/common';
import { AvatarService } from '../../lib/avatar.service';
import { AvatarAnalysis } from '../../interfaces/avatar.interface';

@Controller('avatars')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post()
  async createAvatar(
    @Body('userId') userId: string
  ): Promise<AvatarAnalysis> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.avatarService.createAvatar(userId);
  }

  @Post(':userId/generate')
  async generateResponse(
    @Param('userId') userId: string,
    @Body('prompt') prompt: string
  ): Promise<{ response: string }> {
    if (!userId || !prompt) {
      throw new BadRequestException('userId and prompt are required');
    }
    const response = await this.avatarService.generateResponse(userId, prompt);
    return { response };
  }

  @Put(':userId')
  async updateAvatar(
    @Param('userId') userId: string
  ): Promise<AvatarAnalysis> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.avatarService.updateAvatar(userId);
  }
} 