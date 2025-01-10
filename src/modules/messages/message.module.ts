import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { MessageDeliveryService } from './services/message-delivery.service';
import { RedisCacheModule } from '../../core/cache/redis.module';

@Module({
  imports: [RedisCacheModule],
  providers: [MessageService, MessageGateway, MessageDeliveryService],
  exports: [MessageService],
})
export class MessageModule {}
