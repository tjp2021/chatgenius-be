# Clerk User Integration Documentation

## Overview
This document details how our application integrates with Clerk for user authentication and management. The integration handles user creation, updates, and synchronization between Clerk and our database.

## User Model
Our User model in the database contains these essential fields that map to Clerk:

```typescript
model User {
  id         String    @id        // Clerk user ID (starts with 'user_')
  email      String?              // User's email from Clerk
  name       String?              // Formatted name from Clerk (firstName + lastName)
  imageUrl   String?              // Profile image URL from Clerk
  isOnline   Boolean   @default(false)
  lastSeen   DateTime  @default(now())
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

## Integration Flow

### 1. User Creation Flow
When a new user signs up through Clerk:

1. Frontend sends authenticated request with Clerk token
2. `ClerkGuard` validates the token and extracts user information
3. `UserService.createUser()` is called with Clerk data:
   ```typescript
   {
     id: 'user_...',        // Clerk user ID
     email: 'user@example.com',
     name: 'John Doe',
     imageUrl: 'https://...'
   }
   ```
4. User is created in our database with Clerk's data

### 2. Auto-Creation on First Request
If a user exists in Clerk but not in our database:

1. `findById()` checks for user existence
2. If user ID starts with 'user_' but not found in database:
   ```typescript
   if (!user && id.startsWith('user_')) {
     const name = firstName || lastName 
       ? `${firstName} ${lastName}`.trim()
       : clerkData?.email?.split('@')[0] || 'New User';
     
     return this.createUser({
       id,
       email: clerkData?.email,
       name,
       imageUrl: clerkData?.imageUrl,
     });
   }
   ```
3. User is automatically created with available Clerk data

### 3. User Data Updates
When user data is updated in Clerk:

1. Updates can be triggered through:
   - Direct API calls to `/users/me`
   - Automatic sync during authentication
2. `updateUser()` method handles updates:
   ```typescript
   async updateUser(id: string, data: { 
     name?: string; 
     imageUrl?: string;
     email?: string;
   }): Promise<User>
   ```

### 4. Error Handling
The integration includes comprehensive error handling:

1. Missing User ID:
   ```typescript
   if (!data.id) {
     throw new BadRequestException('User ID is required');
   }
   ```

2. User Not Found:
   ```typescript
   if (!user) {
     throw new NotFoundException(`User with ID ${id} not found`);
   }
   ```

3. Detailed Error Logging:
   ```typescript
   this.logger.error('Error in createUser:', {
     error: error.message,
     code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
     meta: error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined,
     stack: error.stack,
     data
   });
   ```

### 5. Event Emission
The system emits events for user state changes:

1. User Created: `'user.created'`
2. User Updated: `'user.updated'`
3. Status Changed: `'user.status_changed'`

## Security Considerations

1. **Token Validation**: All requests are validated through `ClerkGuard`
2. **ID Verification**: User IDs must match Clerk's format (prefix: 'user_')
3. **Data Integrity**: Updates only allowed for authenticated users
4. **Error Handling**: Comprehensive error handling prevents data leaks

## Best Practices

1. **Automatic Synchronization**: Users are automatically created/updated
2. **Minimal Data Storage**: Only essential user data is stored
3. **Event-Driven Updates**: System emits events for all user changes
4. **Robust Error Handling**: All operations include try-catch blocks
5. **Detailed Logging**: Comprehensive logging for debugging

## Common Operations

### Creating a User
```typescript
await userService.createUser({
  id: clerkId,
  email: clerkEmail,
  name: clerkName,
  imageUrl: clerkImageUrl
});
```

### Updating a User
```typescript
await userService.updateUser(userId, {
  name: newName,
  imageUrl: newImageUrl,
  email: newEmail
});
```

### Finding a User
```typescript
const user = await userService.findById(userId, clerkData);
```

## Troubleshooting

1. **User Not Found**
   - Check if user exists in Clerk
   - Verify user ID format (should start with 'user_')
   - Check authentication token validity

2. **Update Failures**
   - Verify user exists in database
   - Check if all required fields are provided
   - Ensure proper authentication

3. **Event Issues**
   - Verify event service configuration
   - Check event subscription setup
   - Monitor event logs for errors 