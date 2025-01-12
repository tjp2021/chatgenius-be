import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() credentials: { email: string; password: string }) {
    // TODO: Implement actual login logic
    const mockUser = { id: 1, email: credentials.email };
    return {
      access_token: this.authService.generateToken(mockUser),
    };
  }
} 