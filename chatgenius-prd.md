# ChatGenius Channel API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
All endpoints require Clerk authentication. Include the Bearer token in the Authorization header:
```http
Authorization: Bearer <clerk_token>
Content-Type: application/json
```

## Channel API Endpoints

### 1. Create Channel
```http
POST /channels
Authorization: Bearer <clerk_token>
Content-Type: application/json

Body:
{
  "name": string,
  "description": string,
  "type": "PUBLIC" | "PRIVATE" | "DM",
  "targetUserId": string (optional, required for DM)
}

Response (201):
{
  "id": string,
  "name": string,
  "description": string,
  "type": "PUBLIC" | "PRIVATE" | "DM",
  "createdById": string,
  "createdAt": string,
  "lastActivityAt": string,
  "memberCount": number
}
```

### 2. Get Channels List
```http
GET /channels
Authorization: Bearer <clerk_token>

Query Parameters:
- search?: string
- sortBy?: "memberCount" | "messages" | "createdAt" | "name" | "lastActivity"
- sortOrder?: "asc" | "desc"
- type?: "PUBLIC" | "PRIVATE" | "DM"

Response (200):
{
  "channels": [
    {
      "id": string,
      "name": string,
      "type": string,
      "memberCount": number,
      "lastActivity": string,
      "createdAt": string
    }
  ]
}
```

### 3. Get Single Channel
```http
GET /channels/:id
Authorization: Bearer <clerk_token>

Response (200):
{
  "id": string,
  "name": string,
  "type": string,
  "memberCount": number,
  "lastActivity": string,
  "createdAt": string
}
```

### 4. Update Channel
```http
PUT /channels/:id
Authorization: Bearer <clerk_token>
Content-Type: application/json

Body:
{
  "name"?: string,
  "description"?: string,
  "memberRole"?: {
    "userId": string,
    "role": "OWNER" | "MEMBER"
  }
}

Response (200):
Channel object
```

### 5. Delete Channel
```http
DELETE /channels/:id
Authorization: Bearer <clerk_token>

Response (204): No Content
```

### 6. Join Channel
```http
POST /channels/:id/join
Authorization: Bearer <clerk_token>

Response (200):
{
  "success": boolean,
  "channel": {
    "id": string,
    "name": string,
    "type": string
  }
}
```

### 7. Leave Channel
```http
POST /channels/:id/leave
Authorization: Bearer <clerk_token>

Query Parameters:
- shouldDelete?: boolean

Response (200):
{
  "success": boolean
}
```

### 8. Get Channel Members
```http
GET /channels/:channelId/members
Authorization: Bearer <clerk_token>

Response (200):
{
  "members": [
    {
      "id": string,
      "name": string,
      "role": "OWNER" | "MEMBER"
    }
  ]
}
```

### 9. Channel Invitations
```http
POST /channels/:channelId/invitations
Authorization: Bearer <clerk_token>
Content-Type: application/json

Body:
{
  "inviteeId": string
}

Response (200):
{
  "id": string,
  "channelId": string,
  "inviterId": string,
  "inviteeId": string,
  "status": "PENDING",
  "createdAt": string
}
```

### 10. Get Public Channels
```http
GET /channels/public
Authorization: Bearer <clerk_token>

Query Parameters:
- search?: string
- sortBy?: "memberCount" | "messages" | "createdAt" | "name"
- sortOrder?: "asc" | "desc"

Response (200):
{
  "channels": [
    {
      "id": string,
      "name": string,
      "description": string | null,
      "type": "PUBLIC",
      "_count": {
        "members": number,
        "messages": number
      },
      "createdAt": string,
      "isMember": boolean
    }
  ]
}
```

### 11. Get Joined Channels
```http
GET /channels/joined
Authorization: Bearer <clerk_token>

Query Parameters:
- search?: string
- sortBy?: "memberCount" | "messages" | "createdAt" | "name" | "joinedAt"
- sortOrder?: "asc" | "desc"

Response (200):
{
  "channels": [
    {
      "id": string,
      "name": string,
      "description": string | null,
      "type": "PUBLIC" | "PRIVATE" | "DM",
      "_count": {
        "members": number,
        "messages": number
      },
      "createdAt": string,
      "joinedAt": string
    }
  ]
}
```

## Error Responses

All endpoints may return these status codes:

### 400 Bad Request
```http
{
  "statusCode": 400,
  "message": string,
  "error": "Bad Request"
}
```

### 401 Unauthorized
```http
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```http
{
  "statusCode": 403,
  "message": string,
  "error": "Forbidden"
}
```

### 404 Not Found
```http
{
  "statusCode": 404,
  "message": "Channel not found",
  "error": "Not Found"
}
```

### 429 Too Many Requests
```http
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "Too Many Requests"
}
```

### 500 Internal Server Error
```http
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
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