import { Module } from '@nestjs/common';
import { MessageGateway } from './message.gateway';
import { MessageModule } from '../../modules/messages/message.module';
import { WsGuard } from '../../shared/guards/ws.guard';

@Module({
  imports: [MessageModule],
  providers: [MessageGateway, WsGuard],
  exports: [MessageGateway],
})
export class GatewayModule {} 