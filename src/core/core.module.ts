import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaService } from './database/prisma.service';
import { WsGateway } from './ws/ws.gateway';
import { SharedModule } from '../shared/shared.module';
import { EventModule } from './events/event.module';

const services = [PrismaService];
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
    EventModule,
  ],
  providers: [...services, ...gateways],
  exports: [...services, ...gateways, CacheModule],
})
export class CoreModule {} 