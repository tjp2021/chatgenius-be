import { Module, forwardRef } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessageModule } from '../message/message.module';
import { RedisCacheModule } from '../cache/redis.module';
import { MessageGateway } from '../gateways/message.gateway';

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