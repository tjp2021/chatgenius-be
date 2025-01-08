# WebSocket API Documentation

## Overview
This document outlines the WebSocket API endpoints and events for the ChatGenius backend. The WebSocket server is built using NestJS and Socket.IO, providing real-time functionality for user presence, channel management, and messaging.

## Connection

### Base URL
```typescript
const socket = io('YOUR_WEBSOCKET_URL', {
  auth: {
    userId: 'your-user-id'  // Required for authentication
  },
  withCredentials: true
});
```

### Authentication
- Authentication is handled via the `auth` object during connection
- The `userId` is required in the auth object
- CORS is enabled for specified frontend and socket URLs

## Events

### System Events

#### Connection Status
```typescript
// Server emits when a user's online status changes
socket.on('presence:update', (data: { 
  userId: string, 
  isOnline: boolean 
}) => {
  // Handle user presence update
});
```

### Channel Events

#### Join Channel
```typescript
// Client emits to join a channel
socket.emit('channel:join', channelId);

// Server automatically:
// 1. Adds user to channel room
// 2. Updates member count
// 3. Broadcasts member count update
```

#### Leave Channel
```typescript
// Client emits to leave a channel
socket.emit('channel:leave', channelId);

// Server automatically:
// 1. Removes user from channel room
// 2. Updates member count
// 3. Broadcasts member count update
```

#### Channel Updates
```typescript
// Server emits when channel data is updated
socket.on('channel:update', (channelId: string) => {
  // Handle channel update
});

// Server emits when channel member count changes
socket.on('channel:member_count', (data: { 
  channelId: string, 
  count: number 
}) => {
  // Handle member count update
});
```

### Room Subscriptions
Users are automatically subscribed to the following rooms:
- Personal room: `user:{userId}`
- Channel rooms: `channel:{channelId}` (after joining)

## Error Handling
- If `userId` is not provided in auth, connection events will be ignored
- All event handlers include basic error handling and validation
- Connection errors should be handled client-side

## Best Practices

### Connection Management
1. Always include `userId` in the connection auth object
2. Implement proper error handling for connection failures
3. Handle reconnection scenarios appropriately

### Event Handling
1. Join channel rooms before attempting to interact with channel events
2. Clean up event listeners when they're no longer needed
3. Implement proper error handling for all events

### Performance
1. Only join necessary channel rooms
2. Unsubscribe from unused events
3. Handle reconnection with appropriate backoff strategy

## Security Considerations

### Authentication
- All connections require valid authentication
- User identity is verified on connection
- Invalid auth tokens result in connection rejection

### Access Control
- CORS is enabled only for specified origins
- Channel membership is validated server-side
- User presence is tracked and maintained

### Data Protection
- Sensitive data is not exposed through WebSocket events
- Channel access is restricted to authorized members
- User data is properly sanitized before transmission

## TypeScript Interfaces

### Event Payloads
```typescript
interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
}

interface MemberCountUpdate {
  channelId: string;
  count: number;
}
```

## Support
For additional support or questions about the WebSocket API:
- Refer to the implementation documentation
- Contact the development team
- Check the troubleshooting guide 