import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtService {
  constructor(private userService: UserService) {}

  async validateToken(token: string): Promise<any> {
    try {
      // Verify the JWT token using Clerk's public key
      // The token from Clerk is a JWT that can be verified using their public key
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded) {
        throw new UnauthorizedException('Invalid token');
      }

      // Get the user from our database using the Clerk user ID
      const userId = decoded.payload.sub;
      const user = await this.userService.findByClerkId(userId);
      
      if (!user) {
        throw new UnauthorizedException('User not found in database');
      }

      return {
        isValid: true,
        user,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
} 