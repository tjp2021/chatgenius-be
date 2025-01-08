# ChatGenius API Documentation

## Overview
This document provides detailed information about the API endpoints available in the ChatGenius system. It is intended for use by the frontend team to ensure their API calls match the required format and specifications.

## Authentication
All routes require Clerk authentication. Include the `Authorization` header with a valid Bearer token.

```typescript
headers: {
  'Authorization': 'Bearer your_clerk_jwt_token',
  'Content-Type': 'application/json'
}
```

## Base URL
```
http://localhost:3001
```

## Channel API Routes

### Channel Listing

#### Get All Channels
```http
GET /channels
```

**Query Parameters:**
- `search` (optional): Search term for channel names
- `sortBy` (optional): Sort channels by specific field
  - Valid values: `memberCount`, `messages`, `createdAt`, `name`, `lastActivity`
- `sortOrder` (optional): Sort order
  - Valid values: `asc`, `desc`
- `type` (optional): Filter by channel type

**Response** (200 OK)
```typescript
{
  channels: Array<{
    id: string;
    name: string;
    type: ChannelType;
    memberCount: number;
    lastActivity: Date;
    createdAt: Date;
  }>
}
```

#### Get Single Channel
```http
GET /channels/:id
```

**Parameters:**
- `id` (path): Channel ID

**Response** (200 OK)
```typescript
{
  id: string;
  name: string;
  type: ChannelType;
  memberCount: number;
  lastActivity: Date;
  createdAt: Date;
  // Additional channel details
}
```

### Channel Metadata

#### Get Channel Metadata
```http
GET /channels/:channelId/metadata
```

**Parameters:**
- `channelId` (path): Channel ID

**Response** (200 OK)
```typescript
{
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  isJoined: boolean;
  unreadCount: number;
  lastActivity: Date;
}
```

### Channel Activity

#### Get Channel Activity
```http
GET /channels/:id/activity
```

**Parameters:**
- `id` (path): Channel ID

**Response** (200 OK)
```typescript
{
  // Activity data structure
  lastActive: Date;
  activeUsers: number;
  // Additional activity metrics
}
```

#### Get Unread Count
```http
GET /channels/:id/unread
```

**Parameters:**
- `id` (path): Channel ID

**Response** (200 OK)
```typescript
{
  count: number;
}
```

### Public Channels

#### Get Public Channels
```http
GET /channels/public
```

**Query Parameters:**
- `search` (optional): Search term
- `sortBy` (optional): Sort field
- `sortOrder` (optional): Sort direction

**Response** (200 OK)
```typescript
{
  channels: Array<{
    id: string;
    name: string;
    memberCount: number;
    // Public channel specific fields
  }>
}
```

### Joined Channels

#### Get Joined Channels
```http
GET /channels/joined
```

**Query Parameters:**
- `search` (optional): Search term
- `sortBy` (optional): Sort field
- `sortOrder` (optional): Sort direction

**Response** (200 OK)
```typescript
{
  channels: Array<{
    id: string;
    name: string;
    unreadCount: number;
    lastActivity: Date;
    // Joined channel specific fields
  }>
}
```

#### Get Channel Members
```http
GET /channels/:channelId/members
```

**Parameters:**
- `channelId` (path): Channel ID

**Response** (200 OK)
```typescript
{
  members: Array<{
    id: string;
    name: string;
    // Member specific fields
  }>
}
```

## Error Handling

### Error Response Format
```typescript
{
  statusCode: number;
  message: string;
  error: string;
}
```

### Common Status Codes
- `200`: Successful operation
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (invalid or missing authentication)
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `429`: Too many requests (rate limit exceeded)
- `500`: Internal server error

## Implementation Guidelines

### Frontend Best Practices
1. **Caching:**
   - Implement appropriate caching for GET requests
   - Use cache invalidation strategies for data updates

2. **Error Handling:**
   - Implement comprehensive error handling for all status codes
   - Show appropriate user feedback for different error types
   - Implement retry logic for failed requests where appropriate

3. **Type Safety:**
   - Use TypeScript interfaces for request/response data structures
   - Validate data before sending to the API
   - Handle null/undefined values appropriately

4. **Performance:**
   - Implement request debouncing for search inputs
   - Use pagination where available
   - Implement optimistic updates for better UX

5. **Authentication:**
   - Properly handle token expiration
   - Implement refresh token logic
   - Secure storage of authentication tokens

### Rate Limiting
- Default rate limit: 100 requests per minute per IP
- Implement exponential backoff for retry attempts

## WebSocket Events
For real-time updates, implement WebSocket listeners for the following events:
- Channel updates
- New messages
- Member presence
- Typing indicators

## API Versioning
Current API version: v1
Base URL format: `/api/v1/*`

## Redis Configuration

### Local Development Setup
1. **Install Redis**
   ```bash
   # macOS (using Homebrew)
   brew install redis

   # Start Redis service
   brew services start redis
   ```

2. **Environment Variables**
   Make sure these variables are set in your `.env` file:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your_redis_password  # Optional for local development
   ```

3. **Verify Redis Connection**
   ```bash
   # Test Redis connection
   redis-cli ping
   # Should return "PONG"
   ```

### Redis CLI Commands
Useful commands for debugging:
```bash
# Connect to Redis CLI
redis-cli

# List all keys
KEYS *

# Get value for a key
GET <key>

# Delete all keys
FLUSHALL

# Monitor Redis commands in real-time
MONITOR
```

### Redis Status Check
```http
GET /api/v1/health/redis
```
Response:
```json
{
  "status": "connected",
  "ping": "PONG"
}
```

### Cached Endpoints
The following endpoints use Redis caching:
- GET /channels/public (TTL: 5 minutes)
- GET /channels/:id/metadata (TTL: 1 minute)
- GET /channels/:id/members (TTL: 2 minutes)

## Support
For API support or questions, contact the backend team through:
- Slack: #api-support
- Email: api-support@chatgenius.com