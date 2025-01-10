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
      autoConnect: false
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
      this.emit('connect');
    });

    this.socket.on('disconnect', () => {
      this.updateState({ 
        isConnected: false,
        isAuthenticated: false,
        isReady: false
      });
      this.emit('disconnect');
    });

    this.socket.on('connect_error', (error) => {
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

      this.emit('error', error);
    });

    // Custom connection state events
    this.socket.on('connection:starting', () => {
      this.updateState({ isAuthenticated: true });
      this.emit('connection:starting');
    });

    this.socket.on('connection:ready', () => {
      this.updateState({ isReady: true });
      this.emit('connection:ready');
    });

    this.socket.on('connection:error', (error) => {
      this.updateState({ 
        error: new Error(error.message),
        isAuthenticated: false,
        isReady: false
      });
      this.emit('connection:error', error);
    });

    // Reconnection events
    this.socket.on('reconnect', (attemptNumber) => {
      this.reconnectAttempts = 0;
      this.config.onReconnect?.();
      this.emit('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_attempt', () => {
      this.reconnectAttempts++;
      this.updateState({ isConnecting: true });
      this.emit('reconnect_attempt', this.reconnectAttempts);
    });

    this.socket.on('reconnect_failed', () => {
      this.updateState({ 
        isConnecting: false,
        error: new Error('Reconnection failed')
      });
      this.emit('reconnect_failed');
    });
  }

  private updateState(newState: Partial<SocketState>) {
    this.state = { ...this.state, ...newState };
    this.emit('stateChange', this.state);
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

  public emit(event: string, ...args: any[]): boolean {
    if (!this.isConnected()) {
      this.emit('error', new Error('Socket not connected'));
      return false;
    }
    return this.socket?.emit(event, ...args) || false;
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.socket?.on(event, listener);
    return this;
  }

  public off(event: string, listener: (...args: any[]) => void): this {
    this.socket?.off(event, listener);
    return this;
  }

  public updateCredentials(token: string, userId: string) {
    this.config.token = token;
    this.config.userId = userId;
    this.initializeSocket();
  }
} 