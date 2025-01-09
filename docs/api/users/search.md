# User Search API Documentation

## Endpoint Overview
- **Endpoint**: `GET /users/search`
- **Purpose**: Search for users to create DM channels with
- **Authentication**: Required (Clerk Auth Token)

## Query Parameters
| Parameter | Type    | Required | Default | Description                                    |
|-----------|---------|----------|---------|------------------------------------------------|
| search    | string  | No       | -       | Search term for user name or email             |
| page      | number  | No       | 1       | Page number for pagination                     |
| limit     | number  | No       | 10      | Number of users per page (max: 50)            |

## Response Structure
```typescript
interface SearchUsersResponse {
  users: {
    id: string;
    name: string | null;
    imageUrl: string | null;
    isOnline: boolean;
  }[];
  pagination: {
    total: number;     // Total number of users matching search
    page: number;      // Current page number
    limit: number;     // Users per page
    hasMore: boolean;  // Whether there are more pages
  };
}
```

## Key Features
1. **Pagination**: 
   - Default: 10 users per page
   - Maximum: 50 users per page
   - Use `hasMore` to determine if more results are available

2. **Search Capabilities**:
   - Case-insensitive search
   - Matches against user's name or email
   - Current user is automatically excluded from results

3. **Result Ordering**:
   - Primary sort: Online status (online users first)
   - Secondary sort: Name (alphabetical)

## Example Usage

```typescript
// Example using fetch
const searchUsers = async (search?: string, page: number = 1, limit: number = 10) => {
  const params = new URLSearchParams({
    ...(search && { search }),
    ...(page && { page: page.toString() }),
    ...(limit && { limit: limit.toString() })
  });

  const response = await fetch(`/api/users/search?${params}`, {
    headers: {
      'Authorization': `Bearer ${clerkToken}`
    }
  });

  return response.json();
};

// Example Response
{
  "users": [
    {
      "id": "user_2rJq9KAU2BssqEwo8S1IVtwvLKq",
      "name": "John Doe",
      "imageUrl": "https://example.com/avatar.jpg",
      "isOnline": true
    },
    // ... more users
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "hasMore": true
  }
}
```

## Integration with DM Creation
1. Use this endpoint in the "New Direct Message" modal
2. Display search results with user avatars, names, and online status
3. After selecting a user, use their `id` to create a DM channel

## Error Handling
- **401**: Unauthorized (missing or invalid token)
- **400**: Invalid query parameters
- Standard error response format:
  ```typescript
  {
    statusCode: number;
    message: string;
    error: string;
  }
  ```

## Best Practices
1. Implement debouncing for search input (recommended: 300ms)
2. Cache results briefly for better UX
3. Show loading states during searches
4. Handle empty states appropriately
5. Implement infinite scroll or pagination UI

## Rate Limiting
- Standard API rate limits apply
- Implement request throttling on the frontend

## Example React Component
```typescript
import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';

interface User {
  id: string;
  name: string | null;
  imageUrl: string | null;
  isOnline: boolean;
}

const UserSearch = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await searchUsers(debouncedSearch, page);
        setUsers(prev => page === 1 ? response.users : [...prev, ...response.users]);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [debouncedSearch, page]);

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users..."
      />
      {loading && <div>Loading...</div>}
      <ul>
        {users.map(user => (
          <li key={user.id}>
            <img src={user.imageUrl || '/default-avatar.png'} alt="" />
            <span>{user.name}</span>
            {user.isOnline && <span>●</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

## Related Endpoints
- `POST /channels` - Create a DM channel after user selection
- `GET /users/me` - Get current user info 