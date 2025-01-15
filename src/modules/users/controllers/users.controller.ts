import { Controller, Get, Post, Body, UseGuards, Query, Req, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { SyncUserDto } from '../dto/sync-user.dto';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';
import { Request } from 'express';

// Extend the Request type to include auth
interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUser(req.auth?.userId);
  }

  @Get('search')
  @UseGuards(ClerkAuthGuard)
  async searchUsers(
    @Query('q') queryParam: string,
    @Query('query') queryAlt: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const searchQuery = queryParam || queryAlt;
    const currentUserId = req.auth?.userId;
    
    console.log('Search endpoint hit with query:', searchQuery, 'currentUserId:', currentUserId);
    
    if (!currentUserId) {
      throw new UnauthorizedException('User ID not found in request');
    }
    
    return this.usersService.searchUsers(searchQuery, currentUserId);
  }

  @Post('sync')
  async syncUser(@Body() syncUserDto: SyncUserDto) {
    return this.usersService.syncUser(syncUserDto);
  }
} 