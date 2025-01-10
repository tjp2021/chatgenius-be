import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Logger } from '@nestjs/common';

const logger = new Logger('UserDecorator');

export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Look for auth that ClerkGuard sets
    if (!request.auth) {
      throw new UnauthorizedException('User auth not found in request');
    }

    // Log the complete auth object for debugging
    logger.debug('Complete Clerk auth object:', {
      auth: request.auth,
      requestedField: data
    });

    // If asking for specific field, return that
    if (data) {
      switch (data) {
        case 'id':
          return request.auth.userId;
        case 'email':
          return request.auth.email;
        case 'firstName':
          return request.auth.firstName;
        case 'lastName':
          return request.auth.lastName;
        case 'imageUrl':
          return request.auth.imageUrl;
        case 'username':
          return request.auth.username;
        case 'fullName':
          return `${request.auth.firstName || ''} ${request.auth.lastName || ''}`.trim() || undefined;
        case 'primaryEmailAddress':
          return request.auth.primaryEmailAddress;
        case 'primaryPhoneNumber':
          return request.auth.primaryPhoneNumber;
        case 'publicMetadata':
          return request.auth.publicMetadata;
        case 'privateMetadata':
          return request.auth.privateMetadata;
        case 'unsafeMetadata':
          return request.auth.unsafeMetadata;
        default:
          logger.warn(`Requested unknown field: ${data}`);
          return undefined;
      }
    }

    // Otherwise return the full auth object
    return request.auth;
  },
); 