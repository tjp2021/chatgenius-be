import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { TokenBlacklistService } from './token-blacklist.service';
import { Public } from '../decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      // Basic HTTP health check
      () => this.http.pingCheck('auth-service', 'http://localhost:3000/auth/health'),
      
      // Redis connection health check
      async () => {
        try {
          await this.tokenBlacklistService.isBlacklisted('health-check');
          return {
            redis: {
              status: 'up',
            },
          };
        } catch (error) {
          return {
            redis: {
              status: 'down',
              error: error.message,
            },
          };
        }
      },
    ]);
  }
} 