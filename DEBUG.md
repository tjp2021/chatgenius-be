# WebSocket vs HTTP Authentication Debug Guide

## Issue Description
Currently experiencing authentication discrepancy between WebSocket and HTTP requests:
- ✅ WebSocket connections are successfully authenticating
- ❌ HTTP/Axios requests are failing with 401 Unauthorized

## Log Analysis

### WebSocket Logs (Working)
```typescript
[SocketProvider] Initializing with URL: http://localhost:3002
[Auth] [Debug] Setting up auth token getter
[Socket] Creating new instance with config:
► {
    url: 'http://localhost:3002', 
    userId: 'user_2rJq9KAU2BssqEwo8S1IVtwvLKq', 
    hasToken: true
  }

[Socket] Auth data:
► {
    token: 'eyJhbGciOiJSUzI1NiIsImNhdCI6IjgxMNsX0T3ZDRQRDExMUFBQS...', 
    id: 'user_2rJq9KAU2BssqEwo8S1IVtwvLKq', 
    url: 'http://localhost:3002'
  }
```

### HTTP Logs (Failing)
```typescript
▼ GET http://localhost:3002/channels?view=sidebar 401 (Unauthorized)
  fetchChannels @ channel-context.tsx:36
  eval @ channel-context.tsx:49

[Axios] [Debug] Unauthorized request: /channels?view=sidebar
```

## Authentication Flow Analysis

### WebSocket Authentication (Working)
1. **Connection Setup**
   - Establishes connection to: `http://localhost:3002`
   - Authentication included in initial handshake
   - Token present (`hasToken: true`)
   - User ID included in connection data

2. **Token Implementation**
   ```typescript
   const socket = io('http://localhost:3002', {
     auth: {
       token: 'Bearer ${token}',
       userId: 'user_2rJq9KAU2BssqEwo8S1IVtwvLKq'
     }
   });
   ```

### HTTP Authentication (Failing)
1. **Current Request Structure**
   - Endpoint: `http://localhost:3002/channels?view=sidebar`
   - Missing Authorization header
   - No token in request
   - Results in 401 Unauthorized

2. **Expected Request Structure**
   ```typescript
   axios.get('/channels?view=sidebar', {
     headers: {
       Authorization: 'Bearer ${token}'
     }
   });
   ```

## Debug Steps

### 1. Token Verification
```typescript
// Add before HTTP requests
console.log('[Debug] Current token:', await window.Clerk.session.getToken());
console.log('[Debug] Current user:', window.Clerk.user);
```

### 2. Axios Interceptor Check
```typescript
// Add to verify interceptor execution
axios.interceptors.request.use(async (config) => {
  console.log('[Debug] Request config:', config);
  console.log('[Debug] Auth header:', config.headers.Authorization);
  return config;
});
```

### 3. Network Tab Inspection
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Filter by 'XHR' or 'Fetch'
4. Check request headers for:
   - Presence of Authorization header
   - Correct token format
   - Valid token value

## Solution Implementation

### 1. Axios Instance Setup
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3002',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
api.interceptors.request.use(async (config) => {
  const token = await window.Clerk.session.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 2. Request Implementation
```typescript
const fetchChannels = async () => {
  try {
    const response = await api.get('/channels?view=sidebar');
    console.log('[Debug] Channels response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[Debug] Fetch channels error:', error);
    throw error;
  }
};
```

## Verification Steps

1. **Token Format Check**
   - WebSocket token matches HTTP token
   - Bearer prefix is present
   - Token is not expired

2. **Request Headers**
   - Authorization header present
   - Correct token format
   - No malformed headers

3. **CORS Configuration**
   - Backend allows requests from frontend origin
   - Credentials are properly handled
   - Headers are properly exposed

## Common Issues & Solutions

1. **Token Missing**
   - Verify Clerk initialization
   - Check token getter implementation
   - Ensure async token retrieval

2. **Token Format**
   - Confirm 'Bearer ' prefix
   - Validate token string
   - Check for encoding issues

3. **CORS**
   - Verify allowed origins
   - Check credentials handling
   - Confirm header configurations

## Next Steps

1. Implement logging for all authentication flows
2. Add token validation checks
3. Implement error recovery mechanisms
4. Add request/response interceptors for debugging
5. Set up monitoring for auth failures

## Additional Resources

- [Clerk Documentation](https://clerk.dev/docs)
- [Axios Interceptors Guide](https://axios-http.com/docs/interceptors)
- [WebSocket Authentication Best Practices](https://socket.io/docs/v4/middlewares/) 