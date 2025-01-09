import { Module, forwardRef } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelsModule } from '../channels/channels.module';
import { RedisCacheModule } from '../cache/redis.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => ChannelsModule),
    RedisCacheModule
  ],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService]
})
export class MessageModule {}
