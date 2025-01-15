import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { IAuthProvider } from '../interfaces/auth-provider.interface';
import { TokenValidationResponse } from '../types/auth.types';
import { TokenBlacklistService } from '../token-blacklist.service';

@Injectable()
export class ClerkAuthProvider implements IAuthProvider {
  private readonly logger = new Logger(ClerkAuthProvider.name);

  constructor(private readonly tokenBlacklistService: TokenBlacklistService) {}

  async validateToken(token: string): Promise<TokenValidationResponse> {
    try {
      // Parse the JWT to get the session id
      const [_header, payload] = token.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      const sessionId = decodedPayload.sid;

      if (!sessionId) {
        throw new Error('Invalid token format: missing session id');
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Verify the session with Clerk
      const session = await this.verifySession(sessionId, token);
      
      return {
        isValid: true,
        user: {
          id: session.userId,
          sub: session.userId
        }
      };
    } catch (error) {
      this.logger.error('Token validation failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(token: string): Promise<string> {
    try {
      // Clerk handles token refresh through their client SDK
      // This is a placeholder as Clerk manages token lifecycle
      throw new Error('Token refresh not supported with Clerk');
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const [_header, payload] = token.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      const expirationTime = decodedPayload.exp - Math.floor(Date.now() / 1000);

      if (expirationTime > 0) {
        await this.tokenBlacklistService.blacklistToken(token, expirationTime);
      }
    } catch (error) {
      this.logger.error('Token revocation failed:', error);
      throw error;
    }
  }

  async verifySession(sessionId: string, token: string): Promise<{ userId: string; expiresAt: number }> {
    try {
      const session = await clerkClient.sessions.verifySession(sessionId, token);
      return {
        userId: session.userId,
        expiresAt: Math.floor(Date.now() / 1000) + session.expireAt
      };
    } catch (error) {
      this.logger.error('Session verification failed:', error);
      throw error;
    }
  }
} 