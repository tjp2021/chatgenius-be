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

### Message System Logging

```typescript
import { MessageEvent, MessageDeliveryStatus } from './message-events.enum';

interface MessageState {
  messages: Map<string, Message>;
  pendingMessages: Map<string, Message>;
  failedMessages: Map<string, { message: Message; retryCount: number }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// Message State Management
const messageState: MessageState = {
  messages: new Map(),
  pendingMessages: new Map(),
  failedMessages: new Map()
};

// Socket Connection Logging with Recovery
socket.on('connect', async () => {
  console.log('[Socket] Connected successfully');
  console.log('[Socket] Connection ID:', socket.id);
  
  // Recover any pending/failed messages
  await recoverMessageState();
});

socket.on('disconnect', () => {
  console.warn('[Socket] Disconnected');
  // Move all pending messages to failed state
  messageState.pendingMessages.forEach((message, id) => {
    messageState.failedMessages.set(id, { message, retryCount: 0 });
  });
  messageState.pendingMessages.clear();
});

// Enhanced Message Sending with Optimistic Updates
const sendMessage = async (channelId: string, content: string): Promise<Message> => {
  console.log('[Message] Attempting to send message:', { channelId, content });
  
  // Create optimistic message
  const optimisticMessage: Message = {
    id: `temp-${Date.now()}`,
    content,
    channelId,
    userId: currentUserId, // Assume this is available
    createdAt: new Date(),
    updatedAt: new Date(),
    deliveryStatus: MessageDeliveryStatus.SENT,
    user: currentUser // Assume this is available
  };

  // Add to pending messages
  messageState.pendingMessages.set(optimisticMessage.id, optimisticMessage);
  
  // Optimistically update UI
  updateUI(optimisticMessage);

  try {
    // Emit with timeout promise
    const response = await Promise.race([
      new Promise((resolve, reject) => {
        socket.emit(MessageEvent.SEND, {
          channelId,
          content,
        }, (response: SocketResponse<Message>) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        });
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Message send timeout')), 5000)
      )
    ]) as Message;

    console.log('[Message] Send success:', response);
    
    // Remove from pending, add to messages
    messageState.pendingMessages.delete(optimisticMessage.id);
    messageState.messages.set(response.id, response);
    
    // Update UI with real message
    updateUI(response, optimisticMessage.id);
    
    return response;
  } catch (error) {
    console.error('[Message] Send failed:', error);
    
    // Move to failed messages
    messageState.pendingMessages.delete(optimisticMessage.id);
    messageState.failedMessages.set(optimisticMessage.id, {
      message: optimisticMessage,
      retryCount: 0
    });
    
    // Update UI to show failed state
    updateUIError(optimisticMessage.id, error);
    
    // Attempt retry
    await retryMessage(optimisticMessage);
    
    throw error;
  }
};

// Message Retry Logic
const retryMessage = async (message: Message) => {
  const failed = messageState.failedMessages.get(message.id);
  if (!failed || failed.retryCount >= MAX_RETRIES) return;

  // Exponential backoff
  await new Promise(resolve => 
    setTimeout(resolve, RETRY_DELAYS[failed.retryCount])
  );

  try {
    const response = await sendMessage(message.channelId, message.content);
    messageState.failedMessages.delete(message.id);
    return response;
  } catch (error) {
    messageState.failedMessages.set(message.id, {
      message,
      retryCount: failed.retryCount + 1
    });
  }
};

// State Recovery
const recoverMessageState = async () => {
  console.log('[Message] Recovering message state');
  
  // Retry failed messages
  const failedMessages = Array.from(messageState.failedMessages.values());
  for (const { message } of failedMessages) {
    await retryMessage(message);
  }
  
  // Get offline messages
  socket.emit(MessageEvent.OFFLINE_MESSAGES, (response: SocketResponse<Message[]>) => {
    if (response.success) {
      response.data.forEach(message => {
        messageState.messages.set(message.id, message);
        updateUI(message);
      });
    }
  });
};

// Enhanced Message Event Handlers
socket.on(MessageEvent.NEW, (message: Message) => {
  console.log('[Message] Received new message:', message);
  messageState.messages.set(message.id, message);
  updateUI(message);
});

socket.on(MessageEvent.SENT, (message: Message) => {
  console.log('[Message] Message sent confirmation:', message);
  // Update message status in state and UI
  if (messageState.messages.has(message.id)) {
    messageState.messages.set(message.id, {
      ...messageState.messages.get(message.id)!,
      deliveryStatus: MessageDeliveryStatus.SENT
    });
    updateUI(message);
  }
});

socket.on(MessageEvent.DELIVERED, (status: MessageDeliveryStatus) => {
  console.log('[Message] Delivery status update:', status);
  // Update delivery status in state and UI
  if (messageState.messages.has(status.messageId)) {
    const message = messageState.messages.get(status.messageId)!;
    messageState.messages.set(status.messageId, {
      ...message,
      deliveryStatus: MessageDeliveryStatus.DELIVERED
    });
    updateUI(message);
  }
});

socket.on(MessageEvent.ERROR, (error) => {
  console.error('[Message] Message error:', error);
  // Handle error in UI and potentially retry
  if (error.messageId && messageState.messages.has(error.messageId)) {
    const message = messageState.messages.get(error.messageId)!;
    messageState.failedMessages.set(error.messageId, {
      message,
      retryCount: 0
    });
    updateUIError(error.messageId, error);
  }
});

// Enhanced Message Update
const updateMessage = async (messageId: string, content: string): Promise<Message> => {
  console.log('[Message] Attempting to update message:', { messageId, content });
  
  // Optimistically update
  const originalMessage = messageState.messages.get(messageId);
  if (originalMessage) {
    const optimisticUpdate = {
      ...originalMessage,
      content,
      updatedAt: new Date()
    };
    messageState.messages.set(messageId, optimisticUpdate);
    updateUI(optimisticUpdate);
  }
  
  try {
    const response = await new Promise<Message>((resolve, reject) => {
      socket.emit(MessageEvent.UPDATE, {
        messageId,
        content
      }, (response: SocketResponse<Message>) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      });
    });
    
    console.log('[Message] Update success:', response);
    messageState.messages.set(messageId, response);
    updateUI(response);
    return response;
  } catch (error) {
    console.error('[Message] Update failed:', error);
    // Revert optimistic update
    if (originalMessage) {
      messageState.messages.set(messageId, originalMessage);
      updateUI(originalMessage);
    }
    throw error;
  }
};

// Enhanced Message Delete
const deleteMessage = async (messageId: string): Promise<boolean> => {
  console.log('[Message] Attempting to delete message:', messageId);
  
  // Optimistically remove from UI
  const originalMessage = messageState.messages.get(messageId);
  if (originalMessage) {
    messageState.messages.delete(messageId);
    removeFromUI(messageId);
  }
  
  try {
    const success = await new Promise<boolean>((resolve, reject) => {
      socket.emit(MessageEvent.DELETED, {
        messageId
      }, (response: SocketResponse<boolean>) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error));
        }
      });
    });
    
    console.log('[Message] Delete success');
    return success;
  } catch (error) {
    console.error('[Message] Delete failed:', error);
    // Revert optimistic delete
    if (originalMessage) {
      messageState.messages.set(messageId, originalMessage);
      updateUI(originalMessage);
    }
    throw error;
  }
};

/**
 * Implementation Notes:
 * 
 * 1. Message State Management:
 *    - messages: Successfully sent/received messages
 *    - pendingMessages: Messages being sent
 *    - failedMessages: Failed messages with retry count
 * 
 * 2. Optimistic Updates:
 *    - Immediately show message/update in UI
 *    - Revert if operation fails
 *    - Clear temporary state on success
 * 
 * 3. Error Handling:
 *    - Exponential backoff for retries
 *    - Maximum retry attempts
 *    - Proper error state in UI
 * 
 * 4. Offline Support:
 *    - Queue failed messages
 *    - Retry on reconnection
 *    - Fetch missed messages
 * 
 * 5. State Recovery:
 *    - Recover failed messages
 *    - Get offline messages
 *    - Restore UI state
 */
```

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

// Leave channel behavior
interface ChannelLeaveResponse {
  nextChannel: {
    channelId: string;
    type: 'PUBLIC' | 'PRIVATE' | 'DM';
    lastViewedAt: string;
    unreadState: boolean;
  } | null;
}

// Leave channel
const leaveChannel = async (channelId: string, shouldDelete: boolean = false) => {
  const response = await api.delete<ChannelLeaveResponse>(
    `/channels/${channelId}/leave`,
    {
      params: { shouldDelete }
    }
  );
  return response.data;
};

/**
 * Channel Leave Behavior:
 * 
 * 1. Regular Member Leaving:
 *    - Membership is removed
 *    - Channel member count is updated
 *    - Navigation history is cleaned up
 *    - Draft messages are removed
 *    - Returns next channel for navigation
 * 
 * 2. Owner Leaving:
 *    - With shouldDelete=true:
 *      • Entire channel and all memberships are deleted
 *    - With shouldDelete=false:
 *      • If other members exist: Ownership transfers to next member
 *      • If no other members: Channel is deleted
 * 
 * 3. Channel Navigation Priority:
 *    After leaving, automatically navigates to next channel following priority:
 *    1. Public Channels (highest)
 *    2. Private Channels
 *    3. Direct Messages (lowest)
 *    4. Welcome screen (if no channels remain)
 * 
 * 4. Cache Handling:
 *    The following are automatically invalidated:
 *    - User's channel membership
 *    - Channel list
 *    - Channel activity data
 */

// Example usage with navigation
const handleChannelLeave = async (channelId: string, isOwner: boolean) => {
  try {
    const { nextChannel } = await leaveChannel(channelId, isOwner);
    
    if (nextChannel) {
      // Navigate to next channel based on priority
      navigate(`/channels/${nextChannel.channelId}`);
    } else {
      // No channels left, show welcome screen
      navigate('/welcome');
    }
  } catch (error) {
    // Handle errors appropriately
    console.error('Error leaving channel:', error);
  }
};

/**
 * WebSocket Events for Channel Leave:
 * 
 * 1. Client-to-Server:
 *    socket.emit('channel:leave', { channelId: string });
 * 
 * 2. Server-to-Client Events to Listen For:
 *    // When any member leaves the channel
 *    socket.on('channel.member_left', ({ 
 *      channelId: string,
 *      userId: string 
 *    }) => {
 *      // Update member list
 *      // Update member count
 *      // If userId matches current user, cleanup local state
 *    });
 * 
 *    // When channel ownership changes
 *    socket.on('channel.updated', (channel) => {
 *      // Update channel data
 *      // Update owner status if applicable
 *    });
 * 
 *    // When channel is deleted (if owner left with shouldDelete=true)
 *    socket.on('channel.deleted', ({ 
 *      channelId: string 
 *    }) => {
 *      // Remove channel from list
 *      // Navigate away if current channel
 *    });
 * 
 * Note: The server automatically:
 * 1. Removes user from channel room
 * 2. Updates member count
 * 3. Broadcasts member_left event
 * 4. Handles ownership transfer if needed
 */
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