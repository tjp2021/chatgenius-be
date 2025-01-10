import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaService } from './database/prisma.service';
import { EventService } from './events/event.service';
import { WsGateway } from './ws/ws.gateway';
import { SharedModule } from '../shared/shared.module';

const services = [PrismaService, EventService];
const gateways = [WsGateway];

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
  providers: [...services, ...gateways],
  exports: [...services, ...gateways, CacheModule],
})
export class CoreModule {} 