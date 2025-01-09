import { Module } from '@nestjs/common';
import { MessageGateway } from './message.gateway';
import { MessageModule } from '../message/message.module';
import { RedisCacheModule } from '../cache/redis.module';

@Module({
  imports: [MessageModule, RedisCacheModule],
  providers: [MessageGateway],
  exports: [MessageGateway],
})
export class MessageGatewayModule {} 