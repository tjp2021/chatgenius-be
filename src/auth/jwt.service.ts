import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { JwtPayload, ValidatedUser, TokenValidationResponse } from './types/auth.types';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtService {
  private readonly clerkPublicKey: string;
  private readonly logger = new Logger(JwtService.name);

  constructor(
    private userService: UserService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    if (!process.env.CLERK_PEM_PUBLIC_KEY) {
      throw new Error('CLERK_PEM_PUBLIC_KEY environment variable is not set');
    }
    
    // Properly format the PEM key
    const rawKey = process.env.CLERK_PEM_PUBLIC_KEY;
    this.clerkPublicKey = this.formatPublicKey(rawKey);
    
    // Validate the key format
    if (!this.clerkPublicKey.includes('-----BEGIN PUBLIC KEY-----')) {
      throw new Error('Invalid public key format');
    }
  }

  private formatPublicKey(key: string): string {
    // Remove any existing headers and footers
    let cleanKey = key.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n|\r/g, '');
    
    // Add headers and proper formatting
    return [
      '-----BEGIN PUBLIC KEY-----',
      ...cleanKey.match(/.{1,64}/g) || [], // Split into 64-character lines
      '-----END PUBLIC KEY-----'
    ].join('\n');
  }

  async validateToken(token: string): Promise<TokenValidationResponse> {
    try {
      this.logger.debug('Starting token validation');
      
      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(token);
      if (isBlacklisted) {
        this.logger.debug('Token is blacklisted');
        throw new UnauthorizedException('Token has been revoked');
      }

      // Verify the JWT token using Clerk's public key
      this.logger.debug('Verifying JWT token');
      this.logger.debug('Public Key format check:', {
        hasHeader: this.clerkPublicKey.includes('-----BEGIN PUBLIC KEY-----'),
        hasFooter: this.clerkPublicKey.includes('-----END PUBLIC KEY-----'),
        keyLength: this.clerkPublicKey.length,
      });
      
      const decoded = jwt.verify(token, this.clerkPublicKey, {
        algorithms: ['RS256'],
      }) as JwtPayload;

      this.logger.debug('Token decoded successfully:', { 
        sub: decoded.sub,
        exp: decoded.exp,
        hasPayload: !!decoded 
      });

      if (!decoded || !decoded.sub) {
        this.logger.debug('Invalid token payload');
        throw new UnauthorizedException('Invalid token payload');
      }

      const userId = decoded.sub;
      
      if (typeof userId !== 'string') {
        this.logger.debug('Invalid user ID type');
        throw new UnauthorizedException('Invalid user ID in token');
      }

      const user = await this.userService.findById(userId);
      
      if (!user) {
        this.logger.debug('User not found in database');
        throw new UnauthorizedException('User not synchronized yet. Please try again in a few seconds.');
      }

      this.logger.debug('Token validation successful');
      
      // Return only the necessary user information
      return {
        isValid: true,
        user: {
          id: userId,    // This is what Prisma should use
          sub: userId,   // Keep this for reference if needed
        },
      };
    } catch (error) {
      this.logger.error('Token validation failed:', { 
        error: error.message,
        name: error.name,
        stack: error.stack
      });
      
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