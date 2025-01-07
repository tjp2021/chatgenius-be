import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [PrismaModule, ChannelsModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService]
})
export class MessageModule {}
