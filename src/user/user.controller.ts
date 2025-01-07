import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';

@Controller('users')
@UseGuards(ClerkGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  getMe(@User() user: { id: string }) {
    return this.userService.getUser(user.id);
  }

  @Put('me')
  updateMe(
    @User() user: { id: string },
    @Body() data: { name?: string; imageUrl?: string }
  ) {
    return this.userService.updateUser(user.id, data);
  }
} 