import { Injectable, CanActivate, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { createClerkClient } from '@clerk/clerk-sdk-node';

@Injectable()
export class ClerkGuard implements CanActivate {
  private readonly logger = new Logger(ClerkGuard.name);
  private clerk = createClerkClient({ 
    secretKey: process.env.CLERK_SECRET_KEY 
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization token provided');
    }

    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    try {
      const claims = await this.clerk.verifyToken(token);
      
      request.user = {
        id: claims.sub,
      };
      
      return true;
    } catch (error) {
      this.logger.error('Authentication failed:', {
        error: error.message,
        name: error.name
      });
      throw new UnauthorizedException('Invalid token');
    }
  }
} 