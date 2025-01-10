quic# Frontend Socket.IO Integration Guide

## Overview
This document outlines the integration of WebSocket functionality with the ChatGenius backend, including authentication, error handling, and utility implementations.

## Currently Supported Backend Events

### Message Events
```typescript
// 1. Send Message
Event: 'message:send'
Payload: {
  channelId: string;
  content: string;
  tempId?: string;  // Optional, for optimistic updates
}
Response: {
  success: true,
  data: {
    id: string;
    content: string;
    channelId: string;
    userId: string;
    createdAt: string;
  }
} | {
  success: false,
  error: string;
}

// 2. Message Delivered
Event: 'message:delivered'
Payload: {
  messageId: string;
}
Response: {
  success: true
} | {
  success: false,
  error: string;
}

// 3. Message Read
Event: 'message:read'
Payload: {
  messageId: string;
}
Response: {
  success: true
} | {
  success: false,
  error: string;
}

// 4. New Message (Server -> Client)
Event: 'message:new'
Payload: {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
}

// 5. Message Sent Confirmation (Server -> Client)
Event: 'message:sent'
Payload: {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
}
```

### Authentication
```typescript
// Connection Authentication (handled by Socket.IO middleware)
auth: {
  token: string;    // Clerk JWT token
  userId: string;   // Clerk user ID
}

// Error Responses
- 'Authentication failed - missing credentials'
- 'Authentication failed'
- 'User not authenticated'
```

### Connection Events
```typescript
// These are standard Socket.IO events already implemented
1. 'connect': Socket connected successfully
2. 'disconnect': Socket disconnected
3. 'connect_error': Connection/authentication error
4. 'reconnect': Successfully reconnected
```

All these events are currently implemented and working in the backend MessageGateway.

## Basic Integration

### Socket Connection Setup
```typescript
const socket = io(SOCKET_URL, {
  auth: {
    token: "your-clerk-token",    // Required
    userId: "your-user-id"        // Required
  }
});
```

### Error Scenarios
1. **Authentication Errors**:
   - `'Authentication failed - missing credentials'`: Token or userId not provided
   - `'Authentication failed'`: Invalid authentication data
   - `'User not authenticated'`: Session expired or invalid

2. **Connection Errors**:
   - `'connect_error'`: General connection failures
   - `'disconnect'`: Connection lost

### Event Flow
```typescript
// Message Sending
socket.emit('message:send', { 
  channelId: string,
  content: string 
});

// Success Response
{
  success: true,
  data: {
    id: string;
    content: string;
    channelId: string;
    userId: string;
    createdAt: string;
  }
}

// Error Response
{
  success: false,
  error: string
}
```

## Socket Client Utility

### Implementation
```typescript
interface SocketConfig {
  url: string;
  token: string;
  userId: string;
  onAuthError?: (error: Error) => void;
  onConnectionError?: (error: Error) => void;
  onReconnect?: () => void;
}

interface SocketResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ChatSocketClient {
  private socket: Socket;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 1000;

  constructor(private config: SocketConfig) {
    this.initializeSocket();
  }

  private initializeSocket() {
    this.socket = io(this.config.url, {
      auth: {
        token: this.config.token,
        userId: this.config.userId
      },
      reconnection: true,
      reconnectionDelay: this.RECONNECT_DELAY,
      reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.socket.on('connect_error', (error) => {
      if (error.message.includes('Authentication failed')) {
        this.config.onAuthError?.(error);
      } else {
        this.config.onConnectionError?.(error);
      }
    });

    this.socket.on('reconnect', () => {
      this.reconnectAttempts = 0;
      this.config.onReconnect?.();
    });
  }

  async sendMessage<T>(
    channelId: string, 
    content: string,
    tempId?: string
  ): Promise<SocketResponse<T>> {
    return new Promise((resolve) => {
      this.socket.emit('message:send', 
        { channelId, content, tempId },
        (response: SocketResponse<T>) => {
          resolve(response);
        }
      );
    });
  }

  async confirmDelivery(messageId: string): Promise<SocketResponse<void>> {
    return new Promise((resolve) => {
      this.socket.emit('message:delivered', 
        { messageId },
        (response: SocketResponse<void>) => {
          resolve(response);
        }
      );
    });
  }

  async markAsRead(messageId: string): Promise<SocketResponse<void>> {
    return new Promise((resolve) => {
      this.socket.emit('message:read', 
        { messageId },
        (response: SocketResponse<void>) => {
          resolve(response);
        }
      );
    });
  }

  onNewMessage<T>(callback: (message: T) => void) {
    this.socket.on('message:new', callback);
    return () => this.socket.off('message:new', callback);
  }

  updateCredentials(token: string, userId: string) {
    this.config.token = token;
    this.config.userId = userId;
    this.socket.auth = { token, userId };
    this.socket.disconnect().connect();
  }

  disconnect() {
    this.socket.disconnect();
  }
}
```

### Usage Example
```typescript
// Initialize client
const socket = new ChatSocketClient({
  url: SOCKET_URL,
  token: clerkToken,
  userId: clerkUserId,
  onAuthError: async (error) => {
    const newToken = await refreshToken();
    socket.updateCredentials(newToken, userId);
  },
  onConnectionError: (error) => {
    console.error('Connection error:', error);
  },
  onReconnect: () => {
    console.log('Reconnected successfully');
  }
});

// Send message
async function sendMessage() {
  try {
    const response = await socket.sendMessage(
      channelId,
      'Hello!',
      generateTempId()
    );
    
    if (response.success) {
      // Handle success
    } else {
      // Handle error
    }
  } catch (error) {
    // Handle unexpected errors
  }
}

// Listen for new messages
const unsubscribe = socket.onNewMessage((message) => {
  // Handle new message
});

// Cleanup
onUnmount(() => {
  unsubscribe();
  socket.disconnect();
});
```

## React Integration

### Custom Hook
```typescript
function useSocket(config: SocketConfig) {
  const socketRef = useRef<ChatSocketClient>();

  useEffect(() => {
    socketRef.current = new ChatSocketClient(config);

    return () => {
      socketRef.current?.disconnect();
    };
  }, [config.token, config.userId]);

  const sendMessage = useCallback(async (
    channelId: string,
    content: string
  ) => {
    return socketRef.current?.sendMessage(channelId, content);
  }, []);

  return {
    sendMessage,
    socket: socketRef.current
  };
}
```

### Component Usage
```typescript
function ChatComponent() {
  const { sendMessage, socket } = useSocket({
    url: SOCKET_URL,
    token: clerkToken,
    userId: clerkUserId,
    onAuthError: handleAuthError,
    onConnectionError: handleConnectionError
  });

  useEffect(() => {
    const unsubscribe = socket?.onNewMessage((message) => {
      // Handle new message
    });

    return () => unsubscribe?.();
  }, [socket]);

  const handleSend = async (content: string) => {
    const response = await sendMessage(channelId, content);
    if (response?.success) {
      // Handle success
    }
  };

  return (
    // Your chat UI
  );
}
```

## Error Handling Best Practices

1. **Authentication Errors**:
   - Always handle token refresh
   - Implement exponential backoff for retries
   - Show appropriate UI feedback

2. **Connection Issues**:
   - Display connection status
   - Implement offline message queue
   - Show reconnection attempts

3. **Message Errors**:
   - Implement optimistic updates
   - Show sending/failed states
   - Provide retry functionality

## Implementation Checklist

1. [ ] Basic Socket.IO setup
2. [ ] Authentication integration
3. [ ] Error handling implementation
4. [ ] Socket client utility
5. [ ] React hook wrapper
6. [ ] UI feedback components
7. [ ] Offline support
8. [ ] Message retry logic

---
Generated: 2024-01-10
Version: 1.0.0 