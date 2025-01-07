import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from './jwt.service';

@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService) {}

  @Post('validate')
  async validateToken(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization type');
    }

    return this.jwtService.validateToken(token);
  }
} 