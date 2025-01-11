import { io } from 'socket.io-client';

export class SocketClient {
  private socket: any;
  private connectionState: string;
  private readonly INITIAL_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly MAX_RECONNECT_DELAY = 5000;

  constructor(private readonly config: {
    url: string;
    token: string;
    userId: string;
  }) {}

  private initializeSocket() {
    console.log('[Socket] Initializing with config:', {
      url: this.config.url,
      userId: this.config.userId,
      tokenLength: this.config.token.length,
      reconnection: true,
      reconnectionDelay: this.INITIAL_RECONNECT_DELAY,
      reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS
    });

    this.connectionState = 'connecting';

    // Don't modify the URL protocol - Socket.IO handles this internally
    const socketUrl = this.config.url;

    this.socket = io(socketUrl, {
      path: '/api/socket/io',
      auth: {
        token: this.config.token,
        userId: this.config.userId
      },
      reconnection: true,
      reconnectionDelay: this.INITIAL_RECONNECT_DELAY,
      reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
      transports: ['websocket']
    });
  }
} 