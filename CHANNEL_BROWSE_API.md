# Channel Browse API Requirements

## Overview
This document outlines the API requirements for the channel browsing functionality in ChatGenius. The API should support viewing and managing channel memberships through a modal interface.

## API Endpoints

### 1. Get Public Channels
```typescript
GET /api/channels/public

Response:
interface PublicChannelsResponse {
  channels: Array<{
    id: string;
    name: string;
    description: string | null;
    type: 'PUBLIC';
    _count: {
      members: number;
      messages: number;
    };
    createdAt: string;
    isMember: boolean;
  }>;
}

Query Parameters:
- search?: string (filter by name)
- sortBy?: 'memberCount' | 'messages' | 'createdAt' | 'name'
- sortOrder?: 'asc' | 'desc'
```

### 2. Get Joined Channels
```typescript
GET /api/channels/joined

Response:
interface JoinedChannelsResponse {
  channels: Array<{
    id: string;
    name: string;
    description: string | null;
    type: 'PUBLIC' | 'PRIVATE' | 'DM';
    _count: {
      members: number;
      messages: number;
    };
    createdAt: string;
    joinedAt: string;
  }>;
}

Query Parameters:
- search?: string (filter by name)
- sortBy?: 'memberCount' | 'messages' | 'createdAt' | 'name' | 'joinedAt'
- sortOrder?: 'asc' | 'desc'
```

### 3. Join Channel
```typescript
POST /api/channels/:channelId/join

Response:
{
  success: boolean;
  channel: {
    id: string;
    name: string;
    type: 'PUBLIC' | 'PRIVATE' | 'DM';
  };
}
```

### 4. Leave Channel
```typescript
POST /api/channels/:channelId/leave

Response:
{
  success: boolean;
}
```

## WebSocket Events

### Channel Updates
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

// Client emits when joining a channel
socket.emit('channel:join', { channelId: string });

// Client emits when leaving a channel
socket.emit('channel:leave', { channelId: string });
```

## Implementation Notes

### Backend Requirements
1. Filter out channels the user has already joined from the public channels list
2. Include member count and message count in channel data
3. Support sorting by various criteria (member count, activity, etc.)
4. Handle search functionality server-side for better performance
5. Implement proper error handling for invalid requests
6. Ensure proper access control (only public channels can be joined directly)

### Frontend Integration
1. Use the modal component for browsing channels
2. Support real-time updates via WebSocket events
3. Show loading states during API calls
4. Handle errors gracefully with user feedback
5. Update the channel list in real-time after joining/leaving channels
6. Support search and sorting functionality
7. Show appropriate empty states when no channels are found 