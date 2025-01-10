import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
  };
}

export interface SocketResponse<T> {
  data?: T;
  error?: string;
} 