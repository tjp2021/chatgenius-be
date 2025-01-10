import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { createClerkClient } from '@clerk/clerk-sdk-node';

@Injectable()
export class ClerkGuard implements CanActivate {
  private clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionToken = request.headers.authorization?.split(' ')[1];

    if (!sessionToken) {
      return false;
    }

    try {
      // Extract session ID from the JWT
      const [header, payload] = sessionToken.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      const sessionId = decodedPayload.sid;

      // Verify the session with both sessionId and token
      const session = await this.clerk.sessions.verifySession(sessionId, sessionToken);
      
      if (!session || !session.userId) {
        return false;
      }

      // Attach the user ID to the request
      request.userId = session.userId;
      return true;
    } catch (error) {
      console.error('Session verification failed:', error);
      return false;
    }
  }
} 