import { Module } from '@nestjs/common';
import { MessageGateway } from './message.gateway';
import { MessageModule } from '../message/message.module';
import { WsGuard } from '../auth/ws.guard';

@Module({
  imports: [MessageModule],
  providers: [MessageGateway, WsGuard],
  exports: [MessageGateway],
})
export class GatewayModule {} 