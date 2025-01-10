import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../modules/users/user.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuard } from './rate-limit.guard';
import { TokenBlacklistService } from './token-blacklist.service';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { JwtService } from './jwt.service';

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
  controllers: [WebhookController, HealthController],
  providers: [RateLimitGuard, TokenBlacklistService, JwtService],
  exports: [RateLimitGuard, TokenBlacklistService, JwtService],
})
export class AuthModule {}
