import { Module, Global } from '@nestjs/common';
import { ClerkGuard } from './guards/clerk.guard';
import { WsGuard } from './guards/ws.guard';

const guards = [ClerkGuard, WsGuard];

@Global()
@Module({
  providers: [...guards],
  exports: [...guards],
})
export class SharedModule {} 