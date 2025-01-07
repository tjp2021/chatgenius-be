import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from './jwt.service';

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    this.logger.debug('Checking authorization header:', { 
      hasHeader: !!authHeader,
      headerStart: authHeader ? authHeader.substring(0, 20) + '...' : null,
      path: request.path,
      method: request.method
    });

    if (!authHeader) {
      this.logger.debug('No authorization header present');
      throw new UnauthorizedException('No authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      this.logger.debug('Invalid authorization type:', { type });
      throw new UnauthorizedException('Invalid authorization type');
    }

    try {
      const { user } = await this.jwtService.validateToken(token);
      // Attach only the user ID to the request
      request.user = user.id;
      this.logger.debug('Successfully validated token and attached user ID:', { userId: user.id });
      return true;
    } catch (error) {
      this.logger.error('Token validation failed in guard:', { 
        error: error.message,
        name: error.name,
        stack: error.stack
      });
      throw new UnauthorizedException('Invalid token');
    }
  }
} 