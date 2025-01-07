# JWT Authentication API Documentation

## Overview
This API uses Clerk for authentication and implements JWT token validation with additional security features including rate limiting and token blacklisting.

## Base URL
```
http://localhost:3000
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <clerk_jwt_token>
```

## Rate Limiting
- **Limit**: 10 requests per minute per IP
- **Response on exceeded**: `429 Too Many Requests`

## Endpoints

### 1. Health Check
Check the API and Redis service health.

```
GET /health
```

**Authentication Required**: No

**Response Example (200 OK)**:
```json
{
  "status": "ok",
  "info": {
    "auth-service": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  }
}
```

### 2. Token Validation
Validates a Clerk JWT token.

```
POST /auth/validate
```

**Authentication Required**: Yes

**Headers**:
```
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json
```

**Success Response (200 OK)**:
```json
{
  "isValid": true,
  "user": {
    "id": "user_...",
    "email": "user@example.com",
    // ... other user properties
  }
}
```

**Error Responses**:

1. Invalid Token (401 Unauthorized):
```json
{
  "statusCode": 401,
  "message": "Invalid token signature"
}
```

2. Expired Token (401 Unauthorized):
```json
{
  "statusCode": 401,
  "message": "Token has expired"
}
```

3. Blacklisted Token (401 Unauthorized):
```json
{
  "statusCode": 401,
  "message": "Token has been revoked"
}
```

4. Rate Limit Exceeded (429 Too Many Requests):
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## Integration Guide

### 1. Frontend Setup

```typescript
// Utility function for authenticated requests
const makeAuthenticatedRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  // Get token from Clerk
  const token = await auth.getToken();
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`http://localhost:3000${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};
```

### 2. Usage Examples

```typescript
// Example 1: Check if token is valid
try {
  const response = await makeAuthenticatedRequest('/auth/validate');
  console.log('Token is valid:', response.user);
} catch (error) {
  console.error('Token validation failed:', error.message);
}

// Example 2: Making authenticated requests to protected endpoints
try {
  const response = await makeAuthenticatedRequest('/api/protected-route', {
    method: 'POST',
    body: JSON.stringify({ data: 'example' })
  });
  console.log('Response:', response);
} catch (error) {
  if (error.message.includes('Too Many Requests')) {
    console.error('Rate limit exceeded. Please try again later.');
  } else {
    console.error('Request failed:', error.message);
  }
}
```

### 3. Error Handling

```typescript
const handleAuthError = (error: any) => {
  switch (error.message) {
    case 'Invalid token signature':
    case 'Token has expired':
    case 'Token has been revoked':
      // Redirect to login or refresh token
      auth.signOut();
      break;
    case 'ThrottlerException: Too Many Requests':
      // Implement retry with exponential backoff
      break;
    default:
      // Handle other errors
      console.error('Unexpected error:', error);
  }
};
```

## Security Considerations

1. **Token Storage**:
   - Store tokens securely using Clerk's built-in methods
   - Never store tokens in localStorage or cookies

2. **Request Headers**:
   - Always send tokens in the Authorization header
   - Use HTTPS in production

3. **Error Handling**:
   - Implement proper error handling for all authentication failures
   - Consider implementing token refresh logic
   - Handle rate limiting with appropriate retry strategies

4. **Token Expiration**:
   - Tokens have a built-in expiration
   - Implement proper token refresh flow
   - Handle expired token errors gracefully

## Best Practices

1. **Request Pattern**:
   ```typescript
   try {
     const response = await makeAuthenticatedRequest('/endpoint');
     handleSuccess(response);
   } catch (error) {
     handleAuthError(error);
   }
   ```

2. **Token Refresh**:
   - Implement token refresh before expiration
   - Handle 401 responses appropriately
   - Consider using an interceptor for automatic token refresh

3. **Rate Limiting**:
   - Implement client-side rate limiting
   - Add retry logic with exponential backoff
   - Cache responses when appropriate 