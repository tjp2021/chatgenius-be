import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { CoreModule } from '../../core/core.module';
import { MessageRepository } from './message.repository';

@Module({
  imports: [CoreModule],
  controllers: [MessageController],
  providers: [MessageService, MessageRepository],
  exports: [MessageService],
})
export class MessageModule {}
