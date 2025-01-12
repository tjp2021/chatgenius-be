# Channel API Documentation

## Overview
The Channel API provides endpoints for managing channels in the chat application. It uses a view-based approach to serve different UI scenarios efficiently.

## Endpoints

### GET /channels
Fetches channels based on the specified view type.

#### Query Parameters
- `view` (required): Determines which channels to fetch and how they're formatted
  - `'sidebar'`: Channels the user has joined (for sidebar display)
  - `'browse'`: All public channels with join status (for channel browser)
  - `'leave'`: All channels the user has joined (for leave channel view)
- `search` (optional): Filter channels by name
- `cursor` (optional): Cursor for pagination
- `limit` (optional): Number of channels to return

#### Response Types

```typescript
interface ChannelResponse {
  id: string;
  name: string;
  description?: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  isJoined: boolean;  // Whether the current user is a member
  _count: {
    messages: number;
    members: number;
  };
  members: Array<{
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    user: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
  }>;
}
```

#### View-Specific Behaviors

##### 1. Sidebar View (`view=sidebar`)
```typescript
// Request
GET /channels?view=sidebar

// Response
{
  channels: ChannelResponse[];  // Only channels user has joined
}

// Usage
const { data } = await axios.get('/channels?view=sidebar');
sidebarChannels.value = data.channels;
```

##### 2. Browse View (`view=browse`)
```typescript
// Request
GET /channels?view=browse

// Response
{
  channels: ChannelResponse[];  // All public channels with isJoined flag
}

// Usage
const { data } = await axios.get('/channels?view=browse');
browseChannels.value = data.channels;
```

##### 3. Leave View (`view=leave`)
```typescript
// Request
GET /channels?view=leave

// Response
{
  channels: ChannelResponse[];  // All channels user has joined
}

// Usage
const { data } = await axios.get('/channels?view=leave');
leaveChannels.value = data.channels;
```

### Channel Actions

#### Join Channel
```typescript
// Request
POST /channels/:channelId/join

// Response
{
  success: true;
  channel: ChannelResponse;
}

// Usage
await axios.post(`/channels/${channelId}/join`);
// Refetch channels after joining
```

#### Leave Channel
```typescript
// Request
DELETE /channels/:channelId/leave

// Response
{
  success: true;
  wasDeleted: boolean;  // true if channel was deleted (last member or DM)
  message: string;
}

// Usage
const { data } = await axios.delete(`/channels/${channelId}/leave`);
if (data.wasDeleted) {
  // Remove channel from list
} else {
  // Update channel membership status
}
```

## WebSocket Events
The API also emits WebSocket events for real-time updates:

```typescript
// Channel Events
interface ChannelEvent {
  type: 'channel.created' | 'channel.updated' | 'channel.deleted' | 
        'channel.member.joined' | 'channel.member.left' | 
        'channel.member.role.updated';
  channelId: string;
  timestamp: Date;
  data: {
    channelId: string;
    channel?: ChannelResponse;
    userId?: string;
    user?: {
      id: string;
      name: string;
      imageUrl?: string;
    };
    role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  };
}
```

## Best Practices

### State Management
1. Use separate stores for different views:
```typescript
const sidebarChannels = ref<ChannelResponse[]>([]);
const browseChannels = ref<ChannelResponse[]>([]);
const leaveChannels = ref<ChannelResponse[]>([]);
```

### Error Handling
```typescript
try {
  const { data } = await axios.get('/channels', {
    params: { view: 'browse' }
  });
  channels.value = data.channels;
} catch (error) {
  if (error.response?.status === 404) {
    // Handle not found
  } else {
    // Handle other errors
  }
}
```

### Real-time Updates
```typescript
socket.on('channel.member.joined', (event: ChannelEvent) => {
  // Update channel member count
  const channel = channels.value.find(c => c.id === event.channelId);
  if (channel) {
    channel._count.members++;
    if (event.data.userId === currentUser.id) {
      channel.isJoined = true;
    }
  }
});
```

### Performance Tips
1. Use the appropriate view for each scenario to minimize data transfer
2. Implement pagination for large channel lists
3. Cache channel data where appropriate
4. Use WebSocket events to keep the UI in sync 