import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

@Injectable()
export class ClerkGuard implements CanActivate {
  private readonly logger = new Logger('ClerkGuard');
  private clerkAuth = ClerkExpressRequireAuth({
    authorizedParties: [process.env.FRONTEND_URL],
    onError: (err) => {
      this.logger.error('Clerk Auth Error:', err);
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
            this.logger.error('Clerk Auth Error:', err);
            reject(new UnauthorizedException('Authentication failed'));
          }
          resolve(true);
        });
      });

      // Log the complete auth object from Clerk
      this.logger.debug('Complete Clerk session data:', {
        auth: request.auth,
        session: request.session,
        user: request.user
      });

      // The auth middleware will attach the auth object to the request
      if (!request.auth?.userId) {
        throw new UnauthorizedException('User ID not found in token');
      }

      // Ensure all Clerk user data is properly attached to auth object
      request.auth = {
        ...request.auth,
        ...request.user,
        // Ensure critical fields are explicitly mapped
        userId: request.auth.userId || request.user?.id,
        email: request.auth.email || request.user?.emailAddresses?.[0]?.emailAddress,
        firstName: request.auth.firstName || request.user?.firstName,
        lastName: request.auth.lastName || request.user?.lastName,
        username: request.auth.username || request.user?.username,
        imageUrl: request.auth.imageUrl || request.user?.imageUrl,
        // Additional Clerk fields
        primaryEmailAddress: request.user?.primaryEmailAddress,
        primaryPhoneNumber: request.user?.primaryPhoneNumber,
        publicMetadata: request.user?.publicMetadata,
        privateMetadata: request.user?.privateMetadata,
        unsafeMetadata: request.user?.unsafeMetadata
      };

      this.logger.debug('Enriched auth object:', { auth: request.auth });

      return true;
    } catch (error) {
      this.logger.error('Session verification failed:', error);
      throw new UnauthorizedException('Invalid session token');
    }
  }
} 