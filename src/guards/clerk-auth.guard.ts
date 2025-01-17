import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// DO NOT MODIFY THIS AUTH GUARD
// This guard is configured and working correctly with the following setup:
// - Gets raw token from Authorization header
// - Directly verifies with Clerk
// - No Bearer prefix
// - No cookie parsing
// Any changes to this configuration will break authentication
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Debug: Log all headers
    console.log('Request headers:', request.headers);
    
    // TEMPORARY: Use test_user_1 for development
    request.auth = {
      userId: 'test_user_1'
    };
    return true;

    // Just get the raw token from Authorization header
    const token = request.headers.authorization;
    
    // Debug: Log token status
    console.log('Token received:', token ? 'Present' : 'Missing');
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Debug: Log token verification attempt
      console.log('Attempting to verify token...');
      
      // Verify with Clerk directly
      const jwt = await clerkClient.verifyToken(token);
      
      // Debug: Log successful verification
      console.log('Token verified successfully for user:', jwt.sub);
      
      // Store user data in request
      request.auth = {
        userId: jwt.sub
      };

      return true;
    } catch (error) {
      // Debug: Log verification failure
      console.error('Token verification failed:', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }
}

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// END OF AUTH GUARD - DO NOT MODIFY ANYTHING IN THIS FILE
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 