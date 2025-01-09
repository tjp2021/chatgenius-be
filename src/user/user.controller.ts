import { Controller, Get, Put, Body, UseGuards, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';
import { SearchUsersDto, SearchUsersResponseDto } from './dto/search-users.dto';

@Controller('users')
@UseGuards(ClerkGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('search')
  async searchUsers(
    @User() user: { id: string },
    @Query() query: SearchUsersDto
  ): Promise<SearchUsersResponseDto> {
    return this.userService.searchUsers(user.id, query);
  }

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