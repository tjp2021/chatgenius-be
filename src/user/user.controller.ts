import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('users')
@UseGuards(ClerkGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  getMe(@User('id') userId: string) {
    return this.userService.getUser(userId);
  }

  @Put('me')
  updateMe(
    @User('id') userId: string,
    @Body() data: { name?: string; imageUrl?: string }
  ) {
    return this.userService.updateUser(userId, data);
  }
} 