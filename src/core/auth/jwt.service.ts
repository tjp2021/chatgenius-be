import { Injectable } from '@nestjs/common';
import { sign, verify } from 'jsonwebtoken';

@Injectable()
export class JwtService {
  private readonly jwtSecret = process.env.JWT_SECRET;

  generateToken(userId: string): string {
    return sign({ sub: userId }, this.jwtSecret, { expiresIn: '7d' });
  }

  verifyToken(token: string): { sub: string } {
    return verify(token, this.jwtSecret) as { sub: string };
  }
} 