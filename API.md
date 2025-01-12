# ChatGenius Backend API Documentation

## User Synchronization

### POST `/users/sync`

Synchronizes or creates a user in the ChatGenius system.

#### Request Body

```typescript
{
  id: string;          // Required: Unique identifier for the user
  email: string;       // Required: User's email address
  username: string;    // Required: User's username
  firstName?: string;  // Optional: User's first name
  lastName?: string;   // Optional: User's last name
  imageUrl?: string;   // Optional: URL to user's profile image
}
```

#### Response

```typescript
{
  id: string;          // User's ID
  email: string;       // User's email (nullable)
  name: string;        // Combined first and last name (nullable)
  imageUrl: string;    // Profile image URL (nullable)
}
```

#### Example Request

```bash
curl -X POST http://api.chatgenius.com/users/sync \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user_123",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "imageUrl": "https://example.com/avatar.jpg"
  }'
```

#### Example Response

```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "imageUrl": "https://example.com/avatar.jpg"
}
```

#### Notes

- If a user with the provided `id` exists, their information will be updated
- If no user exists with the provided `id`, a new user will be created
- First and last names are combined into a single `name` field with a space between them
- Empty or null `firstName` or `lastName` values are filtered out when combining into `name`
- The `username` field is required in the request but not stored separately (used for display/identification)
- All response fields except `id` are nullable

### GET `/users/:userId`

Retrieves information about a specific user.

#### Parameters

- `userId`: The unique identifier of the user to retrieve

#### Response

Returns the same user object structure as the sync endpoint.

#### Example Request

```bash
curl http://api.chatgenius.com/users/user_123
```

#### Example Response

```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "imageUrl": "https://example.com/avatar.jpg"
}
``` 