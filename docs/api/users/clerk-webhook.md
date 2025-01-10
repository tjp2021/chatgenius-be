# Clerk Webhook Integration

## User Creation Flow

### Overview
- **Endpoint**: `POST /webhooks/clerk`
- **Purpose**: Automatically creates/updates users in the database when they sign up or update their profile through Clerk
- **Authentication**: Requires Clerk webhook signature verification

### User Creation Methods

1. **Primary Method: Webhook**
   - When user signs up through Clerk
   - Webhook creates user with complete profile data
   - Most reliable method with all user information

2. **Fallback Method: First API Call**
   - If authenticated user makes API call before webhook arrives
   - System creates minimal user record if Clerk ID is valid
   - Temporary record with:
     ```typescript
     {
       id: clerkUserId,
       name: "New User",
       email: undefined,
       imageUrl: undefined
     }
     ```
   - Record will be updated when webhook arrives

### Configuration Requirements

1. **Environment Variables**:
```env
CLERK_WEBHOOK_SECRET=your_webhook_secret
```

2. **Clerk Dashboard Setup**:
- Create webhook endpoint in Clerk Dashboard
- Set endpoint URL to: `your_backend_url/webhooks/clerk`
- Copy webhook secret to `CLERK_WEBHOOK_SECRET` env var
- Enable the following events:
  - `user.created`
  - `user.updated`
  - `user.deleted`

### Webhook Security

The endpoint verifies webhook authenticity using:
- `svix-id` header
- `svix-timestamp` header
- `svix-signature` header
- Raw request body

### Event: user.created

When a user signs up through Clerk, the webhook receives:

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

The backend will:
1. Extract user information:
   - Email from primary email address
   - Name from first_name + last_name (or email username if none)
   - Profile image URL
2. Create user in database with:
   - Clerk user ID
   - Extracted email
   - Formatted name
   - Profile image URL

### Implementation Details

1. **User Creation Logic**:
```typescript
{
  id: clerkUserId,
  email: primaryEmailAddress,
  name: formattedName,
  imageUrl: profileImageUrl,
  isOnline: false,
  lastSeen: new Date()
}
```

2. **Error Handling**:
- Invalid webhook signature → 401 Unauthorized
- Missing webhook secret → Server startup error
- User creation failure → 500 Internal Server Error with logs

### Frontend Integration

No manual user creation is needed. Just:
1. Implement Clerk authentication in frontend
2. Use Clerk session token for subsequent API calls
3. Backend will automatically have the user in database

### Sequence Diagram
```
Frontend          Clerk             Backend
   |                |                 |
   |-- Sign Up ---->|                 |
   |<-- Success ----|                 |
   |                |-- Webhook ----->|
   |                |                 |-- Create User in DB
   |                |<-- 200 OK ------|
   |                |                 |
```

### Common Issues

1. **User Not Found Error (500)**:
   - No longer occurs - system creates minimal user record
   - Webhook will update with full profile later
   - Check Clerk Dashboard webhook logs if profile not updating

2. **Invalid Signature (401)**:
   - Mismatched webhook secret
   - Check environment variable matches Clerk Dashboard

3. **Database Constraint Error**:
   - User already exists
   - Check user ID consistency 