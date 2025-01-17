# CORS Configuration Guide

## Backend Configuration (NestJS)

### 1. Main.ts Configuration
```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: ['http://localhost:3000'],  // Your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'x-user-id'        // Explicitly allow x-user-id header
    ],
    credentials: true
  });

  await app.listen(3002);
}
```

### 2. Using CORS Middleware
```typescript
// Alternative: middleware/cors.middleware.ts
export function corsMiddleware(req: any, res: any, next: any) {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-user-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}
```

## Frontend Configuration

### 1. Axios Configuration
```typescript
// api.service.ts
const axiosInstance = axios.create({
  baseURL: 'http://localhost:3002',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Important for CORS with credentials
});
```

### 2. Fetch Configuration
```typescript
const response = await fetch('http://localhost:3002/channels', {
  credentials: 'include',  // Important for CORS with credentials
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-user-id': userId
  }
});
```

## Testing CORS Configuration

```typescript
// Test if CORS is properly configured
async function testCorsConfig() {
  try {
    const response = await fetch('http://localhost:3002/channels?view=sidebar', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-user-id': 'test_user'
      }
    });
    
    if (response.ok) {
      console.log('CORS configured correctly');
    }
  } catch (error) {
    console.error('CORS Error:', error);
  }
}
```

## Common CORS Issues & Solutions

### 1. Preflight Request Failing
If you see the error "Request header field x-user-id is not allowed", ensure:
- Backend explicitly allows the header in `Access-Control-Allow-Headers`
- Custom headers are lowercase (e.g., 'x-user-id' not 'X-User-ID')
- Preflight OPTIONS request is handled correctly

### 2. Credentials Issues
If you see CORS errors with credentials:
- Frontend must set `withCredentials: true` or `credentials: 'include'`
- Backend must set `credentials: true` in CORS config
- Origin must be explicitly specified (no wildcard '*' with credentials)

### 3. Multiple Origins
For multiple frontend URLs:
```typescript
app.enableCors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-production-url.com'
  ],
  // ... other config
});
``` 