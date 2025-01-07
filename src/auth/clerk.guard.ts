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
    
    this.logger.debug('Auth debug:', {
      hasAuthHeader: !!authHeader,
      authHeaderType: authHeader?.split(' ')[0],
      path: request.path,
      method: request.method,
      headers: request.headers,
    });

    if (!authHeader) {
      this.logger.warn('No authorization token provided');
      throw new UnauthorizedException('No authorization token provided');
    }

    const token = authHeader?.split(' ')[1];

    if (!token) {
      this.logger.warn('Invalid authorization header format');
      throw new UnauthorizedException('Invalid authorization header format');
    }

    try {
      // Verify the JWT token
      this.logger.debug('Attempting to verify token...');
      const claims = await this.clerk.verifyToken(token);
      this.logger.debug('Token verified successfully:', { 
        userId: claims.sub,
        claims: claims
      });
      
      // Add the user data to the request
      request.user = {
        id: claims.sub,
      };
      
      return true;
    } catch (error) {
      this.logger.error('Clerk authentication error:', {
        error: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw new UnauthorizedException('Invalid token');
    }
  }
} 