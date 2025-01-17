# API Authentication Guide

## Request Format

### Headers Required
```typescript
{
  'Authorization': 'Bearer ${YOUR_ACCESS_TOKEN}',  // Required for authentication
  'Content-Type': 'application/json',
  'X-User-ID': string,                            // Required: User's unique identifier
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "message": "No user ID provided",
  "error": "Unauthorized",
  "statusCode": 401
}
```
This error occurs when:
1. The `X-User-ID` header is missing
2. The access token is invalid or expired
3. The user ID doesn't match any authorized user

### Example Correct Request

```typescript
// Using fetch
const response = await fetch('/api/search', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_access_token_here',
    'Content-Type': 'application/json',
    'X-User-ID': 'user_123',  // Required
  },
  body: JSON.stringify({
    query: 'your search query',
    topK: 5,                  // Optional
    filter: {                 // Optional
      channelId: 'channel_1'
    }
  })
});

// Using axios
const response = await axios.post('/api/search', 
  {
    query: 'your search query',
    topK: 5,
    filter: {
      channelId: 'channel_1'
    }
  },
  {
    headers: {
      'Authorization': 'Bearer your_access_token_here',
      'Content-Type': 'application/json',
      'X-User-ID': 'user_123',
    }
  }
);
```

### Frontend Service Implementation

```typescript
// api.service.ts
export class ApiService {
  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.getAccessToken()}`,
      'Content-Type': 'application/json',
      'X-User-ID': this.getUserId()
    });
  }

  async search(query: string, options: SearchOptions = {}) {
    return this.http.post('/api/search', 
      { query, ...options },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        if (error.status === 401) {
          // Handle authentication error
          this.handleAuthError();
        }
        throw error;
      })
    );
  }
}
```

## Common Issues & Solutions

### 1. Missing User ID
```typescript
❌ Bad:
headers: {
  'Authorization': 'Bearer token',
  'Content-Type': 'application/json'
}

✅ Good:
headers: {
  'Authorization': 'Bearer token',
  'Content-Type': 'application/json',
  'X-User-ID': 'user_123'  // Always include this
}
```

### 2. Invalid Token Format
```typescript
❌ Bad:
'Authorization': 'token_123'

✅ Good:
'Authorization': 'Bearer token_123'  // Must include 'Bearer ' prefix
```

### 3. Missing Content-Type
```typescript
❌ Bad:
headers: {
  'Authorization': 'Bearer token',
  'X-User-ID': 'user_123'
}

✅ Good:
headers: {
  'Authorization': 'Bearer token',
  'X-User-ID': 'user_123',
  'Content-Type': 'application/json'  // Always include for POST requests
}
```

## Testing Authentication

```typescript
describe('API Authentication', () => {
  it('should reject requests without user ID', async () => {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json'
        // Missing X-User-ID
      }
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: 'No user ID provided',
      error: 'Unauthorized',
      statusCode: 401
    });
  });
}); 