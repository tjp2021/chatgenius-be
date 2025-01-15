import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { promisify } from 'util';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private requireAuth: any;

  constructor() {
    this.requireAuth = promisify(ClerkExpressRequireAuth());
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    try {
      await this.requireAuth(request, response);
      
      // The middleware will set req.auth
      if (!request.auth?.userId) {
        throw new UnauthorizedException('Invalid user ID');
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
} 