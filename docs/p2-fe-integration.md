# Frontend Integration Guide  Phase 2 Complete BE

## Implementation Checklist

### 1. Authentication
- [ ] Setup API Headers
  - [ ] Configure Authorization with Clerk JWT token
  - [ ] Set Content-Type header
- [ ] Implement Clerk Authentication
  - [ ] Setup getToken function
  - [ ] Test token retrieval
- [ ] Configure WebSocket Authentication
  - [ ] Setup Socket.IO with auth token
  - [ ] Configure websocket transport
  - [ ] Test autoConnect functionality

### 2. API Integration
- [ ] REST API Setup
  - [ ] Channel Management
    - [ ] List channels (GET /channels)
    - [ ] Create channel (POST /channels)
    - [ ] Update channel (PUT /channels/:id)
    - [ ] Delete channel (DELETE /channels/:id)
    - [ ] Get channel members (GET /channels/:id/members)
  - [ ] Channel Invitations
    - [ ] Create invitation (POST /channels/:channelId/invitations)
    - [ ] Accept invitation (POST /channels/invitations/:invitationId/accept)
    - [ ] Reject invitation (POST /channels/invitations/:invitationId/reject)
    - [ ] Get pending invitations (GET /channels/invitations/pending)
  - [ ] Error Handling
    - [ ] Handle HTTP errors
    - [ ] Implement retry logic
    - [ ] Handle rate limiting

### 3. WebSocket Connection
- [ ] Implement Connection States
  - [ ] Handle 'connect' event
    - [ ] Process offline messages
    - [ ] Clean typing indicators
    - [ ] Enable message sending/receiving
  - [ ] Handle 'disconnect' event
    - [ ] Show offline UI state
    - [ ] Setup message queue
    - [ ] Clear typing indicators
  - [ ] Handle 'error' event
    - [ ] Authentication errors
    - [ ] Rate limiting
- [ ] Implement Response Format
  - [ ] Handle success/error states
  - [ ] Process response data
  - [ ] Error handling

### 4. Message System
- [ ] Implement Data Types
  - [ ] Message interface
  - [ ] MessageDeliveryStatus interface
- [ ] Message Operations
  - [ ] Send new message
    - [ ] Basic message sending
    - [ ] Handle threaded replies
    - [ ] Success/error handling
  - [ ] Update message
  - [ ] Delete message
- [ ] Message Delivery
  - [ ] Implement delivery confirmation
  - [ ] Implement read receipts
  - [ ] Get message status
  - [ ] Handle offline message count
- [ ] Message Events
  - [ ] Handle message.created
  - [ ] Handle message.updated
  - [ ] Handle message.deleted
  - [ ] Handle message.delivered
  - [ ] Handle message.seen

### 5. Typing Indicators
- [ ] Implement Typing Events
  - [ ] Send typing start
  - [ ] Send typing stop
  - [ ] Get typing users
  - [ ] Handle typing updates
- [ ] Follow Implementation Notes
  - [ ] Set 5s expiration
  - [ ] Implement 500ms debounce
  - [ ] Clear on message send
  - [ ] Handle channel switch cleanup

### 6. Channel Management
- [ ] Channel Subscription
  - [ ] Verify automatic subscription
- [ ] Channel Events
  - [ ] Handle channel.updated
  - [ ] Handle channel.member_joined
  - [ ] Handle channel.member_left

### 7. Error Handling
- [ ] Implement Error Scenarios
  - [ ] Authentication errors
  - [ ] Message delivery failures
  - [ ] Connection issues
- [ ] Implement Retry Strategy
  - [ ] Message retry logic
  - [ ] Exponential backoff
- [ ] State Recovery
  - [ ] Get missed messages
  - [ ] Refresh channel states
  - [ ] Clear stale states

### 8. Best Practices Implementation
- [ ] Connection Management
  - [ ] Exponential backoff
  - [ ] Connection state tracking
  - [ ] UI indicators
- [ ] Message Handling
  - [ ] Optimistic updates
  - [ ] Offline queue
  - [ ] Delivery tracking
- [ ] State Management
  - [ ] Message cache
  - [ ] Channel cleanup
  - [ ] Race condition handling
- [ ] Performance
  - [ ] Typing event debounce
  - [ ] Message batching
  - [ ] Cleanup routines

## Table of Contents
1. [Authentication](#authentication)
2. [API Integration](#api-integration)
3. [WebSocket Connection](#websocket-connection)
4. [Message System](#message-system)
5. [Typing Indicators](#typing-indicators)
6. [Channel Management](#channel-management)
7. [Error Handling](#error-handling)

## Authentication

### Token Handling
```typescript
// IMPORTANT: Different token formats for HTTP vs WebSocket

// 1. For HTTP Requests (REST API)
// - MUST include 'Bearer ' prefix
const httpToken = `Bearer ${await auth.getToken()}`;

// Example HTTP client setup
const api = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(async (config) => {
  config.headers.Authorization = `Bearer ${await auth.getToken()}`; // WITH 'Bearer ' prefix
  return config;
});

// 2. For WebSocket Connection
// - MUST NOT include 'Bearer ' prefix
// - Use raw JWT token directly
const getSocketToken = async () => {
  return await auth.getToken(); // WITHOUT 'Bearer ' prefix
};

// Example WebSocket setup
const socket = io(BACKEND_URL, {
  auth: {
    token: await getSocketToken() // Raw token, no 'Bearer ' prefix
  },
  transports: ['websocket'],
  autoConnect: true
});

// ❌ Common Mistakes:
// 1. Using Bearer prefix in WebSocket auth:
const wrongSocketSetup1 = io(BACKEND_URL, {
  auth: { token: `Bearer ${token}` } // WRONG! Don't add 'Bearer ' prefix
});

// 2. Missing Bearer prefix in HTTP requests:
const wrongHttpSetup = {
  headers: { 
    Authorization: token  // WRONG! Missing 'Bearer ' prefix
  }
};

// 3. Using the same token format for both:
const token = await auth.getToken();
const wrongSetup = {
  http: { Authorization: token },        // WRONG! Missing 'Bearer ' prefix
  socket: { auth: { token: token } }     // Correct for WebSocket
};

// ✅ Correct Usage:
const correctSetup = {
  http: { Authorization: `Bearer ${token}` },  // Correct for HTTP
  socket: { auth: { token: token } }          // Correct for WebSocket
};
```

### Setup
```typescript
// Required headers for all API calls
interface ApiHeaders {
  Authorization: `Bearer ${string}`;  // Clerk JWT token
  'Content-Type': 'application/json';
}

// Clerk authentication setup
const clerkAuth = {
  getToken: async () => {
    const token = await auth.getToken();
    return `Bearer ${token}`;
  }
};

// API client setup
const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
api.interceptors.request.use(async (config) => {
  const token = await clerkAuth.getToken();
  config.headers.Authorization = token;
  return config;
});
```

### WebSocket Authentication
```typescript
// IMPORTANT: Socket Authentication Requirements
// 1. Use raw JWT token from Clerk
// 2. Do NOT add 'Bearer ' prefix
// 3. Send ONLY the token in auth.token

// Get the raw JWT token
const getSocketToken = async () => {
  return await auth.getToken();  // Raw token from Clerk
};

// Correct socket setup
const socket = io(BACKEND_URL, {
  auth: {
    token: await getSocketToken()  // ONLY the token, nothing else
  },
  transports: ['websocket'],
  autoConnect: true
});

// ❌ Common Mistakes:
// 1. Adding Bearer prefix
const wrong1 = io(BACKEND_URL, {
  auth: { 
    token: `Bearer ${token}`  // WRONG! Don't add Bearer
  }
});

// 2. Adding extra fields
const wrong2 = io(BACKEND_URL, {
  auth: { 
    token: token,
    userId: 'some-id'  // WRONG! Don't add userId
  }
});

// 3. Using wrong field name
const wrong3 = io(BACKEND_URL, {
  auth: { 
    jwt: token  // WRONG! Must use 'token' as the field name
  }
});

// ✅ Correct Usage:
const correct = io(BACKEND_URL, {
  auth: { token: token },  // CORRECT: Just the raw token
  transports: ['websocket'],
  autoConnect: true
});
```

The server will:
1. Extract the token from `socket.handshake.auth.token`
2. Verify the token with Clerk
3. Set the userId on the socket internally
4. Handle all subsequent authentication automatically
```

## API Integration

### Channel Management
```typescript
// Channel interfaces
interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  createdAt: string;
  _count: {
    members: number;
    messages: number;
  };
}

interface CreateChannelDto {
  name: string;
  description?: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
}

// List channels
const getChannels = async () => {
  const response = await api.get<Channel[]>('/channels');
  return response.data;
};

// Create channel
const createChannel = async (data: CreateChannelDto) => {
  const response = await api.post<Channel>('/channels', data);
  return response.data;
};

// Update channel
const updateChannel = async (channelId: string, data: Partial<CreateChannelDto>) => {
  const response = await api.put<Channel>(`/channels/${channelId}`, data);
  return response.data;
};

// Delete channel
const deleteChannel = async (channelId: string) => {
  await api.delete(`/channels/${channelId}`);
};

// Get channel members
const getChannelMembers = async (channelId: string) => {
  const response = await api.get(`/channels/${channelId}/members`);
  return response.data;
};
```

### Channel Invitations
```typescript
interface ChannelInvitation {
  id: string;
  channelId: string;
  inviterId: string;
  inviteeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

// Create invitation
const createInvitation = async (channelId: string, inviteeId: string) => {
  const response = await api.post<ChannelInvitation>(
    `/channels/${channelId}/invitations`,
    { inviteeId }
  );
  return response.data;
};

// Accept invitation
const acceptInvitation = async (invitationId: string) => {
  await api.post(`/channels/invitations/${invitationId}/accept`);
};

// Reject invitation
const rejectInvitation = async (invitationId: string) => {
  await api.post(`/channels/invitations/${invitationId}/reject`);
};

// Get pending invitations
const getPendingInvitations = async () => {
  const response = await api.get<ChannelInvitation[]>('/channels/invitations/pending');
  return response.data;
};
```

## WebSocket Connection

### Connection States
```typescript
socket.on('connect', () => {
  // Connection established
  // 1. Offline messages will be automatically processed
  // 2. Typing indicators will be cleaned up
  // 3. Can start sending/receiving messages
});

socket.on('disconnect', () => {
  // Connection lost
  // 1. Show offline state in UI
  // 2. Queue messages locally if needed
  // 3. Clear typing indicators
});

socket.on('error', (error) => {
  // Handle connection errors
  // Common errors: authentication failed, rate limited
});
```

### Response Format
```typescript
interface SocketResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Message System

### Data Types
```typescript
interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deliveryStatus: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  user: User;  // Sender information
}

interface MessageDeliveryStatus {
  messageId: string;
  recipientId: string;
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  timestamp: Date;
}
```

### Sending Messages
```typescript
// Send new message
socket.emit('sendMessage', {
  channelId: string,
  content: string,
  parentId?: string  // For threaded replies
}, (response: SocketResponse<Message>) => {
  if (response.success) {
    // Message sent successfully
    // response.data contains the created message
  } else {
    // Handle error
    console.error(response.error);
  }
});

// Update message
socket.emit('updateMessage', {
  messageId: string,
  content: string
}, (response: SocketResponse<Message>) => {
  // Handle response
});

// Delete message
socket.emit('deleteMessage', {
  messageId: string
}, (response: SocketResponse<boolean>) => {
  // Handle response
});
```

### Message Delivery
```typescript
// Mark message as delivered (when recipient receives it)
socket.emit('message:delivered', {
  messageId: string
});

// Mark message as read
socket.emit('message:seen', {
  messageId: string
});

// Get message delivery status
socket.emit('message:getStatus', {
  messageId: string
}, (response: SocketResponse<MessageDeliveryStatus[]>) => {
  // Shows delivery status for all recipients
});

// Get offline message count
socket.emit('message:getOfflineCount', (response: SocketResponse<{ count: number }>) => {
  // Show notification badge
});
```

### Message Events
```typescript
// Listen for new messages
socket.on('message.created', (message: Message) => {
  // Add message to UI
  // Update channel last message
  // Show notification if needed
});

// Listen for message updates
socket.on('message.updated', (message: Message) => {
  // Update message in UI
});

// Listen for message deletions
socket.on('message.deleted', ({ messageId }: { messageId: string }) => {
  // Remove message from UI
});

// Listen for delivery status changes
socket.on('message.delivered', ({
  messageId,
  recipientId,
  timestamp
}) => {
  // Update message delivery status in UI
});

socket.on('message.seen', ({
  messageId,
  recipientId,
  timestamp
}) => {
  // Update message read status in UI
});
```

## Typing Indicators

### Typing Events
```typescript
// Start typing
socket.emit('typing', {
  channelId: string
});

// Stop typing
socket.emit('typing:stop', {
  channelId: string
});

// Get currently typing users
socket.emit('typing:get', {
  channelId: string
}, (response: SocketResponse<string[]>) => {
  // Array of user IDs who are currently typing
});

// Listen for typing updates
socket.on('user:typing', ({
  userId: string,
  channelId: string,
  isTyping: boolean,
  timestamp: Date
}) => {
  // Update typing indicators in UI
});
```

### Implementation Notes
1. Typing indicators automatically expire after 5 seconds
2. Should debounce typing events (recommended: 500ms)
3. Clear typing state when user sends a message
4. Handle cleanup on channel switch/disconnect

## Channel Management

### Channel Subscription
```typescript
// Backend automatically handles channel subscriptions
// When user joins/leaves channels
// No explicit subscription needed from frontend
```

### Channel Events
```typescript
// Listen for channel updates
socket.on('channel.updated', (channel) => {
  // Update channel in UI
});

// Listen for member updates
socket.on('channel.member_joined', (data) => {
  // Add member to channel
});

socket.on('channel.member_left', (data) => {
  // Remove member from channel
});
```

## Error Handling

### Common Error Scenarios
```typescript
// 1. Authentication Errors
socket.on('error', (error) => {
  if (error.message.includes('authentication')) {
    // Refresh token and reconnect
  }
});

// 2. Message Delivery Failures
socket.on('message.failed', ({
  messageId,
  error
}) => {
  // Show error in UI
  // Provide retry option
});

// 3. Connection Issues
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server disconnected the client
    // May need to reauthenticate
  } else {
    // Connection lost
    // Will automatically try to reconnect
  }
});
```

### Retry Strategy
```typescript
// Message retry example
async function retryMessage(messageId: string, maxAttempts = 3) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await sendMessage(/* ... */);
      break;
    } catch (error) {
      attempts++;
      if (attempts === maxAttempts) {
        // Mark as permanently failed
        // Show error to user
      } else {
        // Wait before retrying
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * attempts)
        );
      }
    }
  }
}
```

### State Recovery
```typescript
// On reconnection
socket.on('connect', async () => {
  // 1. Get missed messages
  const offlineCount = await getOfflineMessageCount();
  if (offlineCount > 0) {
    // Show notification
    // Messages will be processed automatically
  }

  // 2. Refresh channel states
  await refreshChannels();

  // 3. Clear stale states
  clearTypingIndicators();
});
```

## Best Practices

1. **Connection Management**
   - Implement exponential backoff for reconnection
   - Keep track of connection state
   - Show appropriate UI indicators

2. **Message Handling**
   - Implement optimistic updates
   - Queue messages when offline
   - Show delivery/read status
   - Handle failed messages gracefully

3. **State Management**
   - Keep local cache of messages
   - Implement proper cleanup on channel switch
   - Handle race conditions in updates

4. **Error Handling**
   - Show appropriate error messages
   - Implement retry mechanisms
   - Log errors for debugging

5. **Performance**
   - Debounce typing events
   - Batch message updates
   - Implement proper cleanup
   - Cache messages appropriately 