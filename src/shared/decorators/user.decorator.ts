import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Look for userId that ClerkGuard sets
    if (!request.userId) {
      throw new UnauthorizedException('User not found in request');
    }

    // If asking for specific field (like 'id'), return that
    if (data === 'id') {
      return request.userId;
    }

    // Otherwise return the full auth object
    return request.auth;
  },
); 