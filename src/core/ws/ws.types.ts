import { Socket } from 'socket.io';
import { Message, Channel } from '../events/event.types';

export interface AuthenticatedSocket extends Socket {
  userId: string;
}

export type SocketResponse<T> = {
  data?: T;
  error?: string;
}

export interface SocketEvents {
  // Message events
  'message:send': (message: Pick<Message, 'content' | 'channelId'>) => void;
  'message:update': (message: Pick<Message, 'id' | 'content'>) => void;
  'message:delete': (messageId: string) => void;
  
  // Channel events
  'channel:join': (channelId: string) => void;
  'channel:leave': (channelId: string) => void;
  
  // Server emitted events
  'message:new': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string) => void;
  'channel:updated': (channel: Channel) => void;
} 