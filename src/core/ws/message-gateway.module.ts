import { Module } from '@nestjs/common';
import { MessageGateway } from './message.gateway';
import { MessageModule } from '../../modules/messages/message.module';
import { RedisCacheModule } from '../cache/redis.module';
import { WsGuard } from '../../shared/guards/ws.guard';

@Module({
  imports: [MessageModule, RedisCacheModule],
  providers: [MessageGateway],
  exports: [MessageGateway],
})
export class MessageGatewayModule {} 