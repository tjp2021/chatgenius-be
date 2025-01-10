# User API Documentation

## Overview

The user system integrates with Clerk for authentication and user management. Users are automatically created and managed through Clerk webhooks, with fallback mechanisms for immediate access.

## User Creation Flow

### Sequence Diagram
```
Frontend          Clerk             Backend            Database
   |                |                 |                  |
   |-- Sign Up ---->|                 |                  |
   |<-- Success ----|                 |                  |
   |                |                 |                  |
   |                |-- Webhook ----->|                  |
   |                |                 |-- Create User -->|  ┐
   |                |                 |<-- Created -----|  | Primary Flow
   |                |                 |<-- 200 OK ------|  | (Complete Profile)
   |                |                 |                  |  ┘
   |                |                 |                  |
   |-- API Call --->|                 |                  |
   |                |-- Verify Token->|                  |
   |                |<-- Valid -------|                  |
   |                |                 |-- Find User ---->|
   |                |                 |<-- Not Found ----| 
   |                |                 |                  |
   |                |                 |-- Create ------->|  ┐ Fallback Flow
   |                |                 | Minimal User     |  | (Minimal Profile)
   |                |                 |<-- Created -----|  ┘
   |                |                 |                  |
   |                |-- Webhook ----->|                  |  ┐
   |                | (Delayed)       |-- Update User -->|  | Profile Update
   |                |                 |<-- Updated -----|  | (Complete Info)
   |                |<-- 200 OK ------|                  |  ┘
```

### Profile Update Stages

1. **Initial Creation (Fallback)**
   ```typescript
   // Created when user makes first API call but webhook hasn't arrived
   {
     id: "user_123",          // From Clerk token
     name: "New User",        // Default placeholder
     email: undefined,        // Will be filled by webhook
     imageUrl: undefined,     // Will be filled by webhook
     isOnline: false,
     lastSeen: new Date()
   }
   ```

2. **Webhook Update (Complete Profile)**
   ```typescript
   // Updated when webhook arrives with full Clerk profile
   {
     id: "user_123",
     name: "John Doe",        // From Clerk profile
     email: "john@doe.com",   // From Clerk primary email
     imageUrl: "https://...", // From Clerk profile image
     isOnline: false,
     lastSeen: new Date()
   }
   ```

### Update Timing

1. **Immediate Creation (0-1s)**
   - User makes API call
   - Backend verifies Clerk token
   - Creates minimal record if user doesn't exist

2. **Webhook Arrival (1-5s typically)**
   - Clerk sends webhook with complete profile
   - Backend updates minimal record with full information
   - All subsequent API calls see complete profile

3. **Edge Cases**
   - If webhook arrives first: Creates complete profile immediately
   - If webhook delayed: User can still use system with minimal profile
   - If webhook fails: Retry mechanism ensures profile eventually updates

## Authentication

All endpoints require Clerk authentication via Bearer token:
```
Authorization: Bearer <clerk_session_token>
```

## User Creation & Management

### Automatic User Creation

Users are created in two ways:

1. **Primary: Clerk Webhook** (`POST /webhooks/clerk`)
   - Triggered when user signs up/updates in Clerk
   - Creates complete user profile
   - Requires webhook configuration

2. **Fallback: First API Call**
   - Creates minimal user record if authenticated but not in database
   - Updated later by webhook
   - Prevents service disruption

### Webhook Configuration

1. **Environment Variables**:
```env
CLERK_WEBHOOK_SECRET=your_webhook_secret
```

2. **Clerk Dashboard Setup**:
- URL: `your_backend_url/webhooks/clerk`
- Events to enable:
  - `user.created`
  - `user.updated`
  - `user.deleted`

### Webhook Security
- Headers required:
  - `svix-id`
  - `svix-timestamp`
  - `svix-signature`
- Raw body verification

## API Endpoints

### Get Current User
```typescript
GET /users/me

Response: {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  isOnline: boolean;
  lastSeen: Date;
}
```

### Get User by ID
```typescript
GET /users/:id

Response: {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  isOnline: boolean;
  lastSeen: Date;
}
```

### Update User Profile
```typescript
PUT /users/:id
Body: {
  name?: string;
  imageUrl?: string;
}

Response: {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  isOnline: boolean;
  lastSeen: Date;
}
```

### Update User Status
```typescript
PUT /users/:id/status
Body: {
  status: 'online' | 'offline' | 'away'
}

Response: 204 No Content
```

### Search Users
```typescript
GET /users/search?search=<term>&page=<number>&limit=<number>

Query Parameters:
- search: string (optional) - Search term for name/email
- page: number (optional, default: 1) - Page number
- limit: number (optional, default: 10, max: 50) - Users per page

Response: {
  users: Array<{
    id: string;
    name: string | null;
    imageUrl: string | null;
    isOnline: boolean;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
```

### Delete User
```typescript
DELETE /users/:id

Response: 204 No Content
```

## Webhook Events

### user.created Event
```typescript
{
  "type": "user.created",
  "data": {
    "id": string;
    "first_name": string | null;
    "last_name": string | null;
    "email_addresses": Array<{
      "id": string;
      "email_address": string;
    }>;
    "primary_email_address_id": string;
    "image_url": string | null;
  }
}
```

### User Record Structure
```typescript
{
  id: string;           // Clerk user ID
  email: string | null; // Primary email
  name: string | null;  // Formatted name
  imageUrl: string | null;
  isOnline: boolean;    // Current status
  lastSeen: Date;       // Last activity
}
```

## Real-time Events

Users can receive these WebSocket events:
- `user.updated`: When profile is updated
- `user.status_changed`: When online status changes
- `user.deleted`: When account is deleted

## Error Handling

1. **401 Unauthorized**
   - Invalid/missing Clerk token
   - Invalid webhook signature

2. **403 Forbidden**
   - Attempting to modify other users' data

3. **404 Not Found**
   - User ID doesn't exist
   - (Mitigated by automatic creation)

4. **400 Bad Request**
   - Invalid request body
   - Missing required fields

## Implementation Notes

1. **User Creation Priority**:
   - Webhook is primary source of truth
   - Fallback creation ensures service continuity
   - Webhook updates override fallback data

2. **Status Management**:
   - Online status updated automatically
   - Manual status changes possible
   - Last seen updated on activity

3. **Search Behavior**:
   - Case-insensitive name/email search
   - Excludes current user from results
   - Orders by online status, then name

## Common Issues & Solutions

1. **Profile Not Updating**
   - Check webhook logs in Clerk Dashboard
   - Verify webhook URL and secret
   - Check network connectivity

2. **Authentication Issues**
   - Verify Clerk token in request
   - Check environment variables
   - Ensure proper CORS configuration

3. **Performance Considerations**
   - User search is paginated
   - Webhook processing is async
   - Status updates use WebSocket 

## User Information Updates

### Update Triggers

1. **Initial Sign Up**
   ```typescript
   // When user first signs up with Clerk
   Clerk --> Webhook (user.created) --> Backend
   // Creates full user profile with:
   {
     id: "user_123",
     name: "John Doe",
     email: "john@example.com",
     imageUrl: "https://..."
   }
   ```

2. **Profile Changes in Clerk**
   ```typescript
   // When user updates their Clerk profile
   Clerk --> Webhook (user.updated) --> Backend
   // Updates any changed fields:
   {
     name: "John Smith",     // If name changed
     email: "new@email.com", // If email changed
     imageUrl: "https://..."  // If photo changed
   }
   ```

3. **First API Call (Fallback)**
   ```typescript
   // If user makes API call before webhook arrives
   API Call --> Backend
   // Creates minimal profile:
   {
     id: "user_123",          // From Clerk token
     name: "New User",        // Placeholder
     email: undefined,        // Will update when webhook arrives
     imageUrl: undefined      // Will update when webhook arrives
   }
   ```

### Update Order

1. **Best Case (Webhook First)**
   - User signs up in Clerk
   - Webhook arrives (1-2s)
   - Complete profile created
   - User makes API calls
   - Profile already complete

2. **Normal Case (API Call First)**
   - User signs up in Clerk
   - Makes immediate API call
   - Minimal profile created
   - Webhook arrives (1-5s)
   - Profile automatically updated
   - Subsequent API calls see full profile

3. **Edge Case (Delayed Webhook)**
   - User signs up in Clerk
   - Makes API calls
   - Minimal profile used temporarily
   - Webhook arrives late
   - Profile updated whenever webhook arrives

### Profile States

1. **Minimal Profile** (Temporary)
   ```typescript
   {
     id: string;           // From Clerk token
     name: "New User";     // Placeholder
     email: undefined;     // Pending webhook
     imageUrl: undefined;  // Pending webhook
     isOnline: false;
     lastSeen: Date;
   }
   ```

2. **Complete Profile** (After Webhook)
   ```typescript
   {
     id: string;           // Same as before
     name: string;         // From Clerk profile
     email: string;        // From Clerk primary email
     imageUrl: string;     // From Clerk profile
     isOnline: boolean;    // Current status
     lastSeen: Date;       // Last activity
   }
   ```

### WebSocket Events

The system emits events when user information changes:

1. `user.updated`: When profile information changes
   ```typescript
   {
     userId: string;
     name: string;
     email: string;
     imageUrl: string;
   }
   ```

2. `user.status_changed`: When online status changes
   ```typescript
   {
     userId: string;
     status: 'online' | 'offline' | 'away';
     lastSeen: Date;
   }
   ``` 