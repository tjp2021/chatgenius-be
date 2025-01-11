import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

export interface SocketConfig {
  url: string;
  token: string;
  userId: string;
  onAuthError?: (error: Error) => void;
  onConnectionError?: (error: Error) => void;
  onReconnect?: () => void;
}

export interface SocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  isReady: boolean;
  error: Error | null;
}

export type SocketEvent = 
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'connection:starting'
  | 'connection:ready'
  | 'connection:error'
  | 'reconnect'
  | 'reconnect_attempt'
  | 'reconnect_failed'
  | 'stateChange';

export type SocketEventData = {
  'connect': void;
  'disconnect': void;
  'error': Error;
  'connection:starting': void;
  'connection:ready': void;
  'connection:error': Error;
  'reconnect': number;
  'reconnect_attempt': number;
  'reconnect_failed': void;
  'stateChange': SocketState;
}

export class SocketClient extends EventEmitter {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 2000;
  private readonly CONNECT_TIMEOUT = 10000;
  private state: SocketState = {
    isConnected: false,
    isConnecting: false,
    isAuthenticated: false,
    isReady: false,
    error: null
  };

  constructor(private config: SocketConfig) {
    super();
    this.initializeSocket();
  }

  private initializeSocket() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.updateState({ isConnecting: true, error: null });

    this.socket = io(this.config.url, {
      auth: {
        token: this.config.token,
        userId: this.config.userId
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: this.RECONNECT_DELAY,
      reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
      timeout: this.CONNECT_TIMEOUT,
      autoConnect: false,
      withCredentials: true
    });

    // Add connection state logging
    this.socket.io.on("error", (error) => {
      console.error("Socket.IO error:", error);
    });

    this.socket.io.on("reconnect_attempt", () => {
      console.log("Socket.IO attempting reconnect...");
    });

    this.socket.io.on("ping", () => {
      console.log("Socket.IO ping...");
    });

    this.setupEventHandlers();
    this.socket.connect();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.updateState({ 
        isConnected: true, 
        isConnecting: false,
        error: null 
      });
      this.emitEvent('connect');
    });

    this.socket.on('disconnect', () => {
      this.updateState({ 
        isConnected: false,
        isAuthenticated: false,
        isReady: false
      });
      this.emitEvent('disconnect');
    });

    this.socket.on('connect_error', (error: Error) => {
      this.updateState({ 
        isConnected: false,
        isConnecting: false,
        error: error
      });

      if (error.message.includes('Authentication failed')) {
        this.config.onAuthError?.(error);
      } else {
        this.config.onConnectionError?.(error);
      }

      this.emitEvent('error', error);
    });

    // Custom connection state events
    this.socket.on('connection:starting', () => {
      this.updateState({ isAuthenticated: true });
      this.emitEvent('connection:starting');
    });

    this.socket.on('connection:ready', () => {
      this.updateState({ isReady: true });
      this.emitEvent('connection:ready');
    });

    this.socket.on('connection:error', (error: { message: string }) => {
      this.updateState({ 
        error: new Error(error.message),
        isAuthenticated: false,
        isReady: false
      });
      this.emitEvent('connection:error', new Error(error.message));
    });

    // Reconnection events
    this.socket.on('reconnect', (attemptNumber: number) => {
      this.reconnectAttempts = 0;
      this.config.onReconnect?.();
      this.emitEvent('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_attempt', () => {
      this.reconnectAttempts++;
      this.updateState({ isConnecting: true });
      this.emitEvent('reconnect_attempt', this.reconnectAttempts);
    });

    this.socket.on('reconnect_failed', () => {
      this.updateState({ 
        isConnecting: false,
        error: new Error('Reconnection failed')
      });
      this.emitEvent('reconnect_failed');
    });
  }

  private updateState(newState: Partial<SocketState>) {
    this.state = { ...this.state, ...newState };
    this.emitEvent('stateChange', this.state);
  }

  private emitEvent<E extends SocketEvent>(event: E, ...args: SocketEventData[E] extends void ? [] : [SocketEventData[E]]) {
    super.emit(event, ...(args as any[]));
  }

  // Public methods
  public getState(): SocketState {
    return { ...this.state };
  }

  public isConnected(): boolean {
    return this.state.isConnected && this.state.isAuthenticated && this.state.isReady;
  }

  public disconnect() {
    this.socket?.disconnect();
  }

  public connect() {
    this.socket?.connect();
  }

  public sendEvent<T = any>(event: string, data?: T): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Event send timeout'));
      }, this.CONNECT_TIMEOUT);

      this.socket?.emit(event, data, (error?: Error) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public on<E extends SocketEvent>(event: E, listener: (data: SocketEventData[E]) => void): this {
    super.on(event, listener as any);
    return this;
  }

  public off<E extends SocketEvent>(event: E, listener: (data: SocketEventData[E]) => void): this {
    super.off(event, listener as any);
    return this;
  }

  public updateCredentials(token: string, userId: string) {
    this.config.token = token;
    this.config.userId = userId;
    this.initializeSocket();
  }
} 