import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { ClerkGuard } from '../../shared/guards/clerk.guard';
import { User } from '../../shared/decorators/user.decorator';
import { User as UserType } from '../../core/events/event.types';

@Controller('users')
@UseGuards(ClerkGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(
    @User('id') userId: string,
    @Body() data: { email: string; name: string; imageUrl?: string },
  ): Promise<UserType> {
    return this.userService.createUser({
      id: userId,
      ...data,
    });
  }

  @Get('me')
  async getCurrentUser(@User('id') userId: string): Promise<UserType | null> {
    return this.userService.findById(userId);
  }

  @Get(':id')
  async getUser(@Param('id') id: string): Promise<UserType | null> {
    return this.userService.findById(id);
  }

  @Put(':id')
  async updateUser(
    @User('id') userId: string,
    @Param('id') id: string,
    @Body() data: { name?: string; imageUrl?: string },
  ): Promise<UserType> {
    // Only allow users to update their own profile
    if (userId !== id) {
      throw new Error('Cannot update other users');
    }
    return this.userService.updateUser(id, data);
  }

  @Put(':id/status')
  async updateStatus(
    @User('id') userId: string,
    @Param('id') id: string,
    @Body() data: { status: 'online' | 'offline' | 'away' },
  ): Promise<void> {
    // Only allow users to update their own status
    if (userId !== id) {
      throw new Error('Cannot update other users status');
    }
    await this.userService.updateUserStatus(id, data.status);
  }

  @Delete(':id')
  async deleteUser(
    @User('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    // Only allow users to delete their own account
    if (userId !== id) {
      throw new Error('Cannot delete other users');
    }
    await this.userService.deleteUser(id);
  }

  @Post(':id/typing')
  async setTyping(
    @User('id') userId: string,
    @Param('id') id: string,
    @Body() data: { channelId: string; isTyping: boolean },
  ): Promise<void> {
    // Only allow users to set their own typing status
    if (userId !== id) {
      throw new Error('Cannot set typing status for other users');
    }
    await this.userService.setTyping(id, data.channelId, data.isTyping);
  }
} 