# Channel Leave API Documentation

## Endpoint: Delete Channel Membership
```
DELETE /channels/:id/leave
```

## Description
Removes a user's membership from a channel. Handles different scenarios based on the user's role (owner vs. member) and the channel's state.

## URL Parameters
| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| id        | string | Yes      | The channel's UUID    |

## Query Parameters
| Parameter     | Type    | Required | Default | Description                                          |
|--------------|---------|----------|---------|------------------------------------------------------|
| shouldDelete | boolean | No       | false   | If true and user is owner, deletes the entire channel|

## Headers
| Name          | Required | Description                        |
|---------------|----------|------------------------------------|
| Authorization | Yes      | Bearer token for authentication    |

## Response

### Success Response (200 OK)
```typescript
interface ChannelLeaveResponse {
  nextChannel: {
    channelId: string;
    type: 'PUBLIC' | 'PRIVATE' | 'DM';
    lastViewedAt: string;
    unreadState: boolean;
  } | null;
}
```

The `nextChannel` field provides navigation information:
- If `null`: No other channels available, should show welcome screen
- If populated: Details of the next channel to navigate to

### Error Responses

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Channel not found",
  "error": "Not Found"
}
```

#### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## Behavior

1. **Regular Member Leaving**:
   - Deletes channel membership
   - Updates channel member count
   - Cleans up user's navigation history
   - Removes any draft messages
   - Returns next channel for navigation

2. **Owner Leaving**:
   - If `shouldDelete=true`: Deletes entire channel and all memberships
   - If `shouldDelete=false` and other members exist: Transfers ownership to next member
   - If `shouldDelete=false` and no other members: Deletes channel
   - Returns next channel for navigation

## Cache Implications
The following caches are automatically invalidated:
- User's channel membership
- Channel list
- Channel activity data

## Example Usage

```typescript
// Example using axios
const leaveChannel = async (channelId: string, shouldDelete: boolean = false) => {
  try {
    const response = await axios.delete(`/channels/${channelId}/leave`, {
      params: { shouldDelete },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const { nextChannel } = response.data;
    
    if (nextChannel) {
      // Navigate to next channel
      navigate(`/channels/${nextChannel.channelId}`);
    } else {
      // No channels left, show welcome screen
      navigate('/welcome');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      // Handle channel not found
    } else if (error.response?.status === 401) {
      // Handle unauthorized
    } else {
      // Handle other errors
    }
  }
};
```

## State Management Considerations

1. **After Successful Leave**:
   - Remove channel from local channel list cache
   - Update UI to reflect membership change
   - Navigate to next channel or welcome screen
   - Invalidate any related queries/cache

2. **WebSocket Events**:
   - Listen for `channel:leave` events for real-time updates
   - Update other connected clients' state

## Related Endpoints
- `GET /channels/browse/joined` - Get updated list of joined channels
- `GET /channels/:id` - Get channel details
- `GET /channels/:id/metadata` - Get channel metadata 