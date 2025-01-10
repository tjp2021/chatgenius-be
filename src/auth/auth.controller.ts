import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { TokenValidationResponse } from './types/auth.types';

@Controller('auth')
export class AuthController {
  @Post('validate')
  async validateToken(@Headers('authorization') authHeader: string): Promise<TokenValidationResponse> {
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization type');
    }

    try {
      // Parse the JWT to get the session id
      const [_header, payload] = token.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      const sessionId = decodedPayload.sid;

      if (!sessionId) {
        throw new Error('Invalid token format: missing session id');
      }

      // Verify the session with Clerk
      const session = await clerkClient.sessions.verifySession(sessionId, token);
      
      return {
        isValid: true,
        user: {
          id: session.userId,
          sub: session.userId
        }
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
} 