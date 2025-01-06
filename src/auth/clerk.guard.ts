import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Clerk } from '@clerk/clerk-sdk-node';

@Injectable()
export class ClerkGuard implements CanActivate {
  private clerk: Clerk;

  constructor() {
    this.clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      return false;
    }

    try {
      const session = await this.clerk.sessions.verifySession(token);
      request.user = session;
      return true;
    } catch {
      return false;
    }
  }
} 