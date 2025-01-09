import { Module } from '@nestjs/common';
import { MessageGateway } from './message.gateway';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [MessageModule],
  providers: [MessageGateway],
  exports: [MessageGateway],
})
export class MessageGatewayModule {} 