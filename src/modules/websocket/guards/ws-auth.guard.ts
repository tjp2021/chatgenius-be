import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      
      // Log the entire handshake object
      this.logger.debug('Full handshake data:', {
        handshake: {
          auth: client.handshake.auth,
          headers: client.handshake.headers,
          query: client.handshake.query
        }
      });

      const auth = client.handshake.auth || {};
      const headers = client.handshake.headers;

      this.logger.debug('Parsed auth data:', { 
        auth,
        headers: {
          authorization: headers.authorization,
          token: headers.token
        }
      });

      // Extract userId from auth if available
      const providedUserId = auth.userId || headers.userId;
      this.logger.debug('Extracted userId:', { providedUserId });
      
      // Try to get token from different possible locations and handle Bearer prefix
      let token = auth.token || headers.authorization || headers.token;
      this.logger.debug('Initial token value:', { token: token ? `${token.substring(0, 10)}...` : 'undefined' });
      
      // Remove Bearer prefix if present
      if (token?.startsWith('Bearer ')) {
        token = token.substring(7);
        this.logger.debug('Removed Bearer prefix, new token:', { token: `${token.substring(0, 10)}...` });
      }

      if (!token) {
        this.logger.error('No token found in request. Auth data:', { auth, headers });
        throw new WsException('No authentication token provided');
      }

      this.logger.debug('Final token info:', { 
        tokenPreview: token.substring(0, 10) + '...',
        providedUserId,
        socketId: client.id
      });

      // Verify with Clerk
      try {
        const jwt = await clerkClient.verifyToken(token);
        this.logger.debug('Token verified successfully:', { 
          sub: jwt.sub,
          providedUserId,
          azp: jwt.azp,
          iat: jwt.iat,
          socketId: client.id
        });
        
        // Verify that the provided userId matches the token's subject if provided
        if (providedUserId && jwt.sub !== providedUserId) {
          this.logger.error('UserId mismatch:', {
            provided: providedUserId,
            fromToken: jwt.sub,
            socketId: client.id
          });
          throw new WsException('User ID mismatch');
        }

        // Store userId in socket data after successful authentication
        client.data = { 
          ...client.data,
          userId: jwt.sub // Use the subject from JWT as userId
        };

        this.logger.debug('User data stored in socket:', { 
          socketId: client.id,
          userId: jwt.sub,
          data: client.data
        });
        
        return true;
      } catch (error) {
        this.logger.error('Token verification failed:', { 
          error: error.message,
          stack: error.stack,
          socketId: client.id
        });
        throw new WsException('Invalid token');
      }
    } catch (error) {
      this.logger.error('Authentication failed:', { 
        error: error.message,
        stack: error.stack,
        type: error.constructor.name
      });
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Unauthorized');
    }
  }
} 