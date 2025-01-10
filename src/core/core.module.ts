import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaService } from './database/prisma.service';
import { EventService } from './events/event.service';
import { WebSocketGateway } from './ws/ws.gateway';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes
      max: 100, // maximum number of items in cache
    }),
    SharedModule,
  ],
  providers: [
    PrismaService,
    EventService,
    WebSocketGateway,
  ],
  exports: [
    PrismaService,
    EventService,
    WebSocketGateway,
    CacheModule,
  ],
})
export class CoreModule {} 