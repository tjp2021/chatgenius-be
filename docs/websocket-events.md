# WebSocket Events Documentation

## Connection Details

- **WebSocket URL**: `ws://localhost:3002/api/socket.io`
- **Supported Transports**: `['websocket', 'polling']`
- **Configuration**:
  - `pingTimeout`: 60000ms (60 seconds)
  - `pingInterval`: 25000ms (25 seconds)
  - `connectTimeout`: 10000ms (10 seconds)

## Authentication

### Connection Authentication
```typescript
interface AuthPayload {
  token: string;    // Clerk JWT token with 'Bearer ' prefix
  userId: string;   // Clerk user ID
}
```

The client must provide authentication data in the connection handshake:
```javascript
const socket = io('ws://localhost:3002/api/socket.io', {
  auth: {
    token: 'Bearer <clerk-jwt>',
    userId: '<clerk-user-id>'
  }
});
```

## Events

### 1. Message Events

#### `message:send` (Client → Server)
Sent when a user sends a new message.

**Payload**:
```typescript
interface MessagePayload {
  content: string;     // Message content
  channelId: string;   // Target channel ID
  tempId?: string;     // Temporary client-side ID for tracking
}
```

**Response Events**:

a. `message:delivered` (Server → Sender)
```typescript
interface MessageDeliveredPayload {
  messageId: string;           // Server-generated message ID
  tempId: string;             // Client's temporary ID
  status: 'DELIVERED';        // Message delivery status
  processed: true;            // Processing completion flag
}
```

b. `message:created` (Server → Channel)
```typescript
interface MessageCreatedPayload {
  message: {
    id: string;
    content: string;
    channelId: string;
    userId: string;
    replyToId: string | null;
    deliveryStatus: 'DELIVERED';
    createdAt: string;       // ISO timestamp
    updatedAt: string;       // ISO timestamp
    user: {
      id: string;
      name: string;
      imageUrl: string | null;
    }
  };
  tempId: string;            // Client's temporary ID
  processed: true;           // Processing completion flag
}
```

c. `message:failed` (Server → Sender) - On Error
```typescript
interface MessageFailedPayload {
  error: string;             // Error message
  tempId: string;            // Client's temporary ID
  status: 'FAILED';         // Message status
  processed: true;          // Processing completion flag
}
```

### 2. Reaction Events

#### `reaction:add` (Client → Server)
Sent when a user adds a reaction to a message.

**Payload**:
```typescript
interface ReactionPayload {
  messageId: string;    // ID of message being reacted to
  type: string;         // Emoji reaction type
}
```

**Response Event**: `reaction:added` (Server → Channel)
```typescript
interface ReactionAddedPayload {
  messageId: string;
  reaction: {
    id: string;
    type: string;
    userId: string;
    messageId: string;
    createdAt: string;
  };
  processed: true;
}
```

#### `reaction:remove` (Client → Server)
Sent when a user removes their reaction.

**Payload**: Same as `reaction:add`

**Response Event**: `reaction:removed` (Server → Channel)
```typescript
interface ReactionRemovedPayload {
  messageId: string;
  userId: string;
  type: string;
  processed: true;
}
```

### 3. Channel Events

#### `channel:join` (Client → Server)
Sent when a user joins a channel.

**Payload**:
```typescript
interface ChannelJoinPayload {
  channelId: string;
}
```

**Response Events**:

a. `channel:user_joined` (Server → Channel)
```typescript
interface UserJoinedPayload {
  userId: string;
  channelId: string;
  timestamp: string;    // ISO timestamp
}
```

### 4. Connection Events

#### `connection:success` (Server → Client)
Sent after successful authentication.
```typescript
interface ConnectionSuccessPayload {
  userId: string;
  channels: string[];    // List of channel IDs user has access to
}
```

#### `connection:error` (Server → Client)
Sent on connection/authentication errors.
```typescript
interface ConnectionErrorPayload {
  error: string;
  reason: string;
  reconnectAttempt: number;
}
```

## Message Processing Flow

1. Client sends message:
   ```javascript
   socket.emit('message:send', {
     content: 'Hello world',
     channelId: 'channel-123',
     tempId: 'temp-123'
   });
   ```

2. Server processes message:
   - Validates authentication
   - Creates message in database
   - Updates delivery status
   - Emits events

3. Client receives confirmation:
   - Gets `message:delivered` (sender only)
   - Gets `message:created` (all channel members)
   - Updates UI with final message state

## Error Handling

### Common Error Scenarios

1. Authentication Failures
```typescript
{
  error: 'User not authenticated',
  reason: 'auth_error',
  reconnectAttempt: 1
}
```

2. Message Processing Failures
```typescript
{
  error: 'Message already being processed',
  tempId: 'temp-123',
  status: 'FAILED',
  processed: true
}
```

## Best Practices

1. **Message Deduplication**:
   - Always include `tempId` for message tracking
   - Server maintains processing set to prevent duplicates
   - Key format: `${clientId}:${tempId || content}`

2. **Error Recovery**:
   - Implement exponential backoff for reconnections
   - Store unsent messages locally
   - Retry failed messages with new `tempId`

3. **Event Handling**:
   - Listen for both specific events and general socket errors
   - Update UI optimistically but confirm with server events
   - Handle disconnections gracefully 

## Message Delivery Status

### Status Types
```typescript
type DeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
```

### Status Flow
1. **SENDING**: Initial state when message is sent from client
   ```typescript
   // Client-side temporary message state
   {
     tempId: string;
     content: string;
     status: 'SENDING';
     timestamp: Date;
   }
   ```

2. **SENT**: Server has received and validated the message
   ```typescript
   // Server → Client (message:delivered event)
   {
     messageId: string;
     tempId: string;
     status: 'SENT';
     timestamp: string;
   }
   ```

3. **DELIVERED**: Message has been saved and broadcast to channel
   ```typescript
   // Server → Channel (message:created event)
   {
     message: {
       id: string;
       deliveryStatus: 'DELIVERED';
       // ... other message fields
     }
   }
   ```

4. **READ**: (Optional) Message has been seen by recipient
   ```typescript
   // Server → Channel (message:read event)
   {
     messageId: string;
     userId: string;
     status: 'READ';
     timestamp: string;
   }
   ```

5. **FAILED**: Message processing failed
   ```typescript
   // Server → Sender (message:failed event)
   {
     tempId: string;
     error: string;
     status: 'FAILED';
     timestamp: string;
   }
   ```

### Status Updates
- Each status change triggers a corresponding event
- Clients should maintain local message state
- UI should reflect current status with appropriate indicators
- Failed messages should allow for retry with new tempId

### Example Client Implementation
```typescript
interface MessageState {
  tempId: string;
  messageId?: string;
  content: string;
  status: DeliveryStatus;
  error?: string;
  timestamp: Date;
  retryCount: number;
}

// Status management
const messageStates = new Map<string, MessageState>();

// Handle status updates
socket.on('message:delivered', (data) => {
  const message = messageStates.get(data.tempId);
  if (message) {
    message.status = data.status;
    message.messageId = data.messageId;
  }
});

socket.on('message:failed', (data) => {
  const message = messageStates.get(data.tempId);
  if (message) {
    message.status = 'FAILED';
    message.error = data.error;
  }
});
``` 