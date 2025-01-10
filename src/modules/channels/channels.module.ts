import { Module, forwardRef } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { PrismaModule } from '../../core/database/prisma.module';
import { MessageModule } from '../../modules/messages/message.module';
import { RedisCacheModule } from '../../core/cache/redis.module';
import { MessageGateway } from '../../core/ws/message.gateway';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MessageModule),
    RedisCacheModule
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService, MessageGateway],
  exports: [ChannelsService]
})
export class ChannelsModule {} 