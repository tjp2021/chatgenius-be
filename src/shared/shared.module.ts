import { Module, Global } from '@nestjs/common';
import { ClerkGuard } from './guards/clerk.guard';
import { WsGuard } from './guards/ws.guard';
import { JwtGuard } from './guards/jwt.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { ThrottlerModule } from '@nestjs/throttler';

const guards = [ClerkGuard, WsGuard, JwtGuard, RateLimitGuard];

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 60000,
      limit: 10,
    }]),
  ],
  providers: [...guards],
  exports: [...guards],
})
export class SharedModule {} 