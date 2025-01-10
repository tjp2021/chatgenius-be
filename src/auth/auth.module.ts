import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../modules/users/user.module';
import { RateLimitGuard } from '../shared/guards/rate-limit.guard';
import { TokenBlacklistService } from './token-blacklist.service';

@Module({
  imports: [UserModule],
  controllers: [WebhookController],
  providers: [RateLimitGuard, TokenBlacklistService],
  exports: [RateLimitGuard, TokenBlacklistService],
})
export class AuthModule {}
