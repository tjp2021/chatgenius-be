# Channel Navigation and Default Views PRD

## 1. Overview

### 1.1 Problem Statement
Users need a clear and intuitive way to navigate channels within the ChatGenius platform. The system must intelligently handle various states of channel membership and provide appropriate default views.

### 1.2 Goals
- Create a consistent and intuitive channel navigation experience
- Provide clear entry points for new users
- Implement logical default views based on user membership status
- Maintain clear organization between public, private, and DM channels

## 2. User States and Behaviors

### 2.1 New User (No Channel Membership)
When a user has no channel memberships:
- Display a welcome screen as the default view
- Show clear CTAs for:
  - Browsing available public channels
  - Starting a direct message
  - Creating a new channel (if permissions allow)
- Provide contextual help about different channel types

### 2.2 Single Channel Membership
When a user is a member of exactly one channel:
- Automatically redirect to that channel regardless of type
- Show the channel sidebar with appropriate organization
- Highlight the active channel

### 2.3 Multiple Channel Memberships
When a user belongs to multiple channels, select default view in this priority:
1. First public channel (chronological by join date)
2. First private channel (if no public channels)
3. First DM (if no public or private channels)

### 2.4 Channel Transition Behavior
When a user leaves channels, the system must automatically transition to the next appropriate channel following a strict hierarchy:

Priority Order:
1. Public Channels (highest priority)
2. Private Channels
3. Direct Messages (lowest priority)

Transition Rules:
- If user leaves all channels → Show default welcome view
- If user leaves a public channel:
  - If other public channels exist → Show next public channel
  - If no public channels remain → Show first private channel
  - If no private channels → Show first DM
- If user leaves a private channel:
  - If other private channels exist → Show next private channel
  - If no private channels remain → Show first DM
- If user leaves a DM:
  - If other DMs exist → Show next DM
  - If no DMs remain → Show default welcome view

Example Scenario:
User has: 2 public channels, 2 private channels, 2 DMs
1. Leaves Public Channel #1 → Renders Public Channel #2
2. Leaves Public Channel #2 → Renders Private Channel #1
3. Leaves Private Channel #1 → Renders Private Channel #2
4. Leaves Private Channel #2 → Renders first DM
5. Leaves first DM → Renders second DM
6. Leaves second DM → Renders default welcome view

## 3. Channel Organization

### 3.1 Sidebar Structure
Channels must be organized into three distinct sections:
1. Public Channels
   - Marked with # icon
   - Show join button for non-joined channels
   - Display member count (optional)

2. Private Channels
   - Marked with 🔒 icon
   - Only show channels user is member of
   - Display member count

3. Direct Messages
   - Marked with @ icon
   - Show online status indicator
   - Alphabetically sorted

### 3.2 Channel Types and Access

#### Public Channels
- Joining Methods:
  - Click "Join Channel" button in channel browser
  - Accept direct channel link/invite
  - Added by channel admin
- Visibility: Listed in channel browser
- Access: Read-only until joined

#### Private Channels
- Joining Methods:
  - Invited during channel creation
  - Added by channel admin/owner
  - Request to join (requires approval)
- Visibility: Hidden from non-members
- Access: No access until membership granted

#### Direct Messages
- Creation: Select user(s) to initiate
- Visibility: Only visible to participants
- Access: Automatic for participants

## 4. Technical Requirements

### 4.1 Database Schema Requirements
- Channel model must track:
  - Channel type (PUBLIC/PRIVATE/DM)
  - Creation date
  - Member relationships
  - Last activity timestamp
  - Member count
  - Member join dates (for ordering)
  - Leave/exit events
  - Previous active channel (for navigation history)

### 4.2 Channel Navigation Logic

#### 4.2.1 Navigation State Management
- Maintain navigation history stack:
  - Last 10 unique channels
  - Clear on workspace switch
  - Preserve across sessions
  - Support back/forward navigation

- Current Channel Tracking:
  - Active channel ID
  - Previous channel ID
  - Last viewed timestamp
  - Unread state
  - Draft messages

#### 4.2.2 Transition Handling
- Success Flow:
  1. Begin transition (optimistic UI)
  2. Update navigation stack
  3. Load new channel data
  4. Update URL/history
  5. Mark previous as read

- Failure Handling:
  1. Retry transition (max 3 attempts)
  2. Revert to previous channel
  3. Show error notification
  4. Log failure reason
  5. Provide manual refresh option

#### 4.2.3 Real-time Updates
- WebSocket events for:
  - Channel membership changes
  - Permission updates
  - Archive/unarchive
  - User presence
  - New message indicators

### 4.2 Performance Requirements

#### 4.2.1 Load Time Targets
- Initial channel list: < 500ms
- Channel switch time: < 200ms
- Default view resolution: < 100ms

#### 4.2.2 Large Scale Handling
- Channel List Pagination:
  - Initial load: 50 channels
  - Subsequent loads: 30 channels
  - Infinite scroll with 500ms debounce
  - Preserve scroll position on navigation

- Optimistic Updates:
  - Channel joins/leaves
  - Membership changes
  - Status updates
  - Recent activity

#### 4.2.3 Background Loading
- Preload adjacent channels
- Progressive channel metadata
- Lazy load historical messages
- Defer non-critical data

### 4.3 Caching Strategy

#### 4.3.1 Cache Layers
- Client-side caching:
  - Channel list (SWR/React Query with 30s revalidation)
  - User online status (WebSocket updates)
  - Channel metadata (1 minute TTL)
  - Message previews (5 minute TTL)

- Server-side caching (Redis):
  - Channel membership data (1 hour TTL)
  - User presence data (2 minute TTL)
  - Channel activity counters (5 minute TTL)
  - Message counts (15 minute TTL)

#### 4.3.2 Cache Invalidation
- Immediate invalidation triggers:
  - Channel membership changes
  - Channel settings updates
  - User role changes
  - Channel deletion/archival

- Background refresh triggers:
  - New messages (partial metadata update)
  - User presence changes
  - Member count changes
  - Activity level changes

#### 4.3.3 Cache Warm-up
- Preload on workspace entry:
  - User's joined channels
  - Recent DM participants
  - Frequently accessed channels
  - Public channel directory (paginated)

## 5. UI/UX Requirements

### 5.1 Channel Browser
- Grid/list view toggle
- Search functionality
- Filter by:
  - Channel type
  - Member count
  - Activity level
  - Creation date
- Sort by:
  - Alphabetical
  - Member count
  - Activity
  - Creation date

### 5.2 Default Welcome View

#### 5.2.1 Display Rules
- Always shown when user has no channel memberships
- Non-dismissible by design
- Automatically appears after leaving last channel
- Exits only when joining/creating a channel

#### 5.2.2 Core Components
Must include:
1. Welcome header ("Welcome to ChatGenius!")
2. Clear explanation of channel types
   - Public channels (#)
   - Private channels (🔒)
   - Direct Messages (@)
3. Primary Actions
   - "Browse Channels" button
   - "Start a Direct Message" button
   - "Create a Channel" button (if permissions allow)
4. Visual channel type guide
5. Basic help documentation

#### 5.2.3 Behavior
- Serves as default landing page for no-channel state
- Appears immediately after last channel exit
- No session persistence needed
- Consistent experience across all user states

### 5.3 Channel Navigation
- Keyboard shortcuts for navigation
- Clear visual hierarchy
- Unread indicators
- Mention badges
- Activity indicators

## 6. Edge Cases and Considerations

### 6.1 Error States
- Handle network connectivity issues
- Invalid channel access attempts
- Deleted channel handling
- Permission denied scenarios

### 6.2 Special Cases
- Archived channels
- Channels at member capacity
- Rate limiting for channel joining
- Bulk channel operations

## 7. Success Metrics

### 7.1 User Engagement
- Time to first message
- Channel join rate
- Cross-channel activity
- Return user retention

### 7.2 Performance Metrics
- Channel load times
- Navigation response times
- Error rates
- Cache hit rates

## 8. Future Considerations

### 8.1 Potential Enhancements
- Channel categories/folders
- Custom channel ordering
- Enhanced channel discovery
- Advanced permission systems
- Channel templates

### 8.2 Scalability Considerations
- Large workspace support
- High channel count handling
- Active user scaling
- Message volume handling