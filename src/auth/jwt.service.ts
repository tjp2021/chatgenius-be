import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TokenBlacklistService } from './token-blacklist.service';
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  sub: string;
  exp?: number;
  [key: string]: any;
}

@Injectable()
export class JwtService {
  private readonly clerkPublicKey: string;

  constructor(
    private userService: UserService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    if (!process.env.CLERK_PEM_PUBLIC_KEY) {
      throw new Error('CLERK_PEM_PUBLIC_KEY environment variable is not set');
    }
    this.clerkPublicKey = process.env.CLERK_PEM_PUBLIC_KEY.replace(/\\n/g, '\n');
  }

  async validateToken(token: string): Promise<any> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Verify the JWT token using Clerk's public key
      const decoded = jwt.verify(token, this.clerkPublicKey, {
        algorithms: ['RS256'],
      }) as JwtPayload;

      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const userId = decoded.sub;
      
      if (typeof userId !== 'string') {
        throw new UnauthorizedException('Invalid user ID in token');
      }

      const user = await this.userService.findById(userId);
      
      if (!user) {
        throw new UnauthorizedException('User not found in database');
      }

      return {
        isValid: true,
        user,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token signature');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, this.clerkPublicKey, {
        algorithms: ['RS256'],
      }) as JwtPayload;

      if (!decoded.exp) {
        throw new Error('Token has no expiration');
      }

      // Calculate remaining time until token expiration
      const expirationTime = decoded.exp - Math.floor(Date.now() / 1000);
      if (expirationTime > 0) {
        await this.tokenBlacklistService.blacklistToken(token, expirationTime);
      }
    } catch (error) {
      throw new UnauthorizedException('Failed to revoke token');
    }
  }
} 