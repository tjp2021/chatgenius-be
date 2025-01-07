import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../user/user.module';
import { JwtService } from './jwt.service';
import { AuthController } from './auth.controller';
import { JwtGuard } from './jwt.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuard } from './rate-limit.guard';
import { TokenBlacklistService } from './token-blacklist.service';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';

@Module({
  imports: [
    UserModule,
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 60000,
      limit: 10,
    }]),
    TerminusModule,
    HttpModule,
  ],
  controllers: [WebhookController, AuthController, HealthController],
  providers: [JwtService, JwtGuard, RateLimitGuard, TokenBlacklistService],
  exports: [JwtService, JwtGuard, RateLimitGuard, TokenBlacklistService],
})
export class AuthModule {}
