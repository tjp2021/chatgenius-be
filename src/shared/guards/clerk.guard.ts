import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

@Injectable()
export class ClerkGuard implements CanActivate {
  private clerkAuth = ClerkExpressRequireAuth({
    authorizedParties: [process.env.FRONTEND_URL],
    onError: (err) => {
      console.error('Clerk Auth Error:', err);
      throw new UnauthorizedException('Authentication failed');
    }
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    try {
      // Use the new networkless verification
      await new Promise((resolve, reject) => {
        this.clerkAuth(request, response, (err) => {
          if (err) {
            console.error('Clerk Auth Error:', err);
            reject(new UnauthorizedException('Authentication failed'));
          }
          resolve(true);
        });
      });

      // The auth middleware will attach the auth object to the request
      if (!request.auth?.userId) {
        throw new UnauthorizedException('User ID not found in token');
      }

      // Attach the user ID to the request for convenience
      request.userId = request.auth.userId;
      return true;
    } catch (error) {
      console.error('Session verification failed:', error);
      throw new UnauthorizedException('Invalid session token');
    }
  }
} 