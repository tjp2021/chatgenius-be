import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { CoreModule } from '../../core/core.module';

@Module({
  imports: [CoreModule],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}
