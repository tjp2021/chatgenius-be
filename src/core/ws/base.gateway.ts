import { WebSocketGateway as NestGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventService } from '../events/event.service';
import { AuthenticatedSocket } from '../../shared/types/ws.types';

@NestGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class BaseGateway {
  @WebSocketServer()
  protected server: Server;

  constructor(protected readonly eventService: EventService) {}

  protected success<T>(data: T) {
    return {
      success: true,
      data,
    };
  }

  protected error(message: string) {
    return {
      success: false,
      error: message,
    };
  }

  protected getClientUserId(client: AuthenticatedSocket): string {
    return client.data.userId;
  }

  protected validateClient(client: AuthenticatedSocket): boolean {
    const userId = this.getClientUserId(client);
    if (!userId) {
      client.disconnect();
      return false;
    }
    return true;
  }
} 