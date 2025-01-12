import { Controller, Get } from '@nestjs/common';
import { WebsocketService } from '../services/websocket.service';

@Controller()
export class WebsocketController {
  constructor(private readonly websocketService: WebsocketService) {}

  @Get('chat-test')
  async chatTest() {
    return {
      status: 'success',
      message: 'WebSocket server is running',
      connections: this.websocketService.getActiveConnections()
    };
  }
} 