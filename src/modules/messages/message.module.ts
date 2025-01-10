import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { MessageDeliveryService } from './services/message-delivery.service';
import { OfflineMessageService } from './services/offline-message.service';
import { TypingIndicatorService } from './services/typing-indicator.service';
import { RedisCacheModule } from '../../core/cache/redis.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { EventModule } from '../../core/events/event.module';

@Module({
  imports: [RedisCacheModule, PrismaModule, EventModule],
  controllers: [MessageController],
  providers: [
    MessageService,
    MessageGateway,
    MessageDeliveryService,
    OfflineMessageService,
    TypingIndicatorService
  ],
  exports: [MessageService],
})
export class MessageModule {}
