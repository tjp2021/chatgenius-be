import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { SyncUserDto } from '../dto/sync-user.dto';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { User } from '../../../auth/decorators/user.decorator';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@User('sub') userId: string) {
    return this.usersService.getUser(userId);
  }

  @Post('sync')
  async syncUser(@Body() syncUserDto: SyncUserDto) {
    return this.usersService.syncUser(syncUserDto);
  }
} 