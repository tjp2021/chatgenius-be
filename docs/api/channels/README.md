# Channels API Documentation

## Overview
The Channels API provides endpoints for managing different types of channels (Public, Private, and Direct Messages) in the chat system.

## Base URL
All routes are prefixed with `/channels`

## Authentication
All endpoints require authentication using Clerk. Include the Bearer token in the Authorization header:
```http
Authorization: Bearer <clerk_token>
```

## Channel Types

### 1. PUBLIC Channels
- Visible to all users
- Anyone can join
- No invitation needed
- Maximum 1000 members
- Listed in public channel browsing

### 2. PRIVATE Channels
- Only visible to members
- Requires invitation/explicit addition
- Maximum 1000 members
- Owner can manage members
- Not listed in public browsing

### 3. DM (Direct Message) Channels
- Always exactly 2 members
- Created automatically when initiating a DM
- Both users added on creation
- Cannot be joined by others
- Special naming convention
- Private by default

## Endpoints

### 1. Create Channel
Creates a new channel. For DMs, automatically adds both users as members.

```http
POST /channels
```

#### Request Body
```typescript
interface CreateChannelDto {
  name: string;
  description?: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  targetUserId?: string;  // Required for DM channels
}
```

#### Response
```typescript
interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: ChannelType;
  createdById: string;
  members: ChannelMember[];
  createdAt: string;
  lastActivityAt: string;
  memberCount: number;
}
```

### 2. List Channels
Returns a list of channels the authenticated user has access to.

```http
GET /channels
```

#### Query Parameters
```typescript
interface QueryParams {
  search?: string;              // Search by name or description
  sortBy?: 'memberCount' | 'messages' | 'createdAt' | 'name' | 'lastActivity';
  sortOrder?: 'asc' | 'desc';
  type?: 'PUBLIC' | 'PRIVATE' | 'DM';
}
```

#### Response
```typescript
interface ChannelWithStats[] {
  id: string;
  name: string;
  description: string | null;
  type: ChannelType;
  createdById: string;
  createdAt: string;
  lastActivityAt: string;
  memberCount: number;
  messageCount: number;
  unreadCount: number;
  lastReadAt: string | null;
  isMember: boolean;
}
```

### 3. Get Single Channel
Returns detailed information about a specific channel.

```http
GET /channels/:id
```

#### Response
```typescript
interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: ChannelType;
  members: {
    userId: string;
    role: 'OWNER' | 'MEMBER';
    user: {
      id: string;
      name: string;
      imageUrl: string | null;
      isOnline: boolean;
    };
  }[];
  messages: {
    id: string;
    content: string;
    createdAt: string;
    user: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
  }[];  // Latest 50 messages
}
```

### 4. Join Channel
Join a public channel. Not available for PRIVATE or DM channels.

```http
POST /channels/:id/join
```

#### Response
```typescript
interface JoinResponse {
  channel: {
    id: string;
    name: string;
    type: ChannelType;
  };
  user: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
}
```

### 5. Leave/Delete Channel
Leave a channel or delete it if you're the owner.

```http
DELETE /channels/:id/leave
```

#### Query Parameters
```typescript
interface LeaveParams {
  shouldDelete?: boolean;  // If true and user is owner, deletes the channel
}
```

#### Response
```typescript
interface LeaveResponse {
  nextChannel: {
    channelId: string;
    type: ChannelType;
    lastViewedAt: string;
    unreadState: boolean;
  } | null;
}
```

### 6. Mark Channel as Read
Marks all messages in the channel as read for the current user.

```http
POST /channels/:id/read
```

#### Response
```json
{
  "success": true
}
```

### 7. Get Unread Count
Get the number of unread messages in a channel.

```http
GET /channels/:id/unread
```

#### Response
```json
{
  "count": 0
}
```

### 8. Get Channel Activity
Get the latest activity information for a channel.

```http
GET /channels/:id/activity
```

#### Response
```typescript
interface ActivityResponse {
  lastActivity: string;
  memberCount: number;
}
```

### 9. Get Channel Metadata
Get channel metadata including the last message preview.

```http
GET /channels/:channelId/metadata
```

#### Response
```typescript
interface ChannelMetadataDto {
  name: string;
  description: string | null;
  unreadCount: number;
  memberCount: number;
  lastMessagePreview: string | null;
}
```

## Error Responses

All endpoints can return these error responses:

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Access to this channel is denied"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Channel not found"
}
```

### 410 Gone
```json
{
  "statusCode": 410,
  "message": "This channel has been deleted"
}
```

### 503 Service Unavailable
```json
{
  "statusCode": 503,
  "message": "Network connectivity issues detected",
  "retry": true,
  "timestamp": "2024-01-09T16:00:00.000Z"
}
```

## WebSocket Events

The channel system also supports real-time updates through WebSocket events:

### Server-to-Client Events

```typescript
// Channel data updated
socket.on('channel:update', (channelId: string) => {
  // Handle channel update
});

// Member count changed
socket.on('channel:member_count', (data: { 
  channelId: string;
  count: number;
}) => {
  // Handle member count update
});
```

### Client-to-Server Events

```typescript
// Join channel
socket.emit('channel:join', { 
  channelId: string 
});

// Leave channel
socket.emit('channel:leave', { 
  channelId: string 
});
```

## Rate Limiting
- Standard API rate limits apply
- Implement request throttling on the frontend
- Cache results when appropriate

## Best Practices

1. **Channel Creation**
   - Use meaningful names for channels
   - Provide descriptions for public channels
   - For DMs, follow the naming convention
   - Handle errors appropriately

2. **Channel Management**
   - Cache channel lists for better performance
   - Implement proper cleanup when leaving channels
   - Handle ownership transfer for private channels
   - Maintain proper access control

3. **Real-time Updates**
   - Listen for WebSocket events
   - Update UI immediately on events
   - Handle reconnection scenarios
   - Implement proper error handling

4. **Performance**
   - Use pagination where available
   - Cache responses when appropriate
   - Implement proper error handling
   - Handle network issues gracefully 