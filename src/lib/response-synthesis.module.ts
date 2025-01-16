import { Module } from '@nestjs/common';
import { ResponseSynthesisService } from './response-synthesis.service';
import { ConfigModule } from '@nestjs/config';
import { ContextWindowService } from './context-window.service';
import { RateLimitService } from './rate-limit.service';
import { VectorStoreModule } from './vector-store.module';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [
    ConfigModule,
    VectorStoreModule,
    PrismaModule
  ],
  providers: [
    ResponseSynthesisService,
    ContextWindowService,
    RateLimitService
  ],
  exports: [ResponseSynthesisService]
})
export class ResponseSynthesisModule {} 