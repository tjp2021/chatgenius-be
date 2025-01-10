# ChatGenius Feature Module Organization

## 1. Schema Organization

```prisma
// prisma/schema.prisma - Split into feature-specific files for organization
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// Core types used across features
enum UserRole {
  USER
  ADMIN
}

enum ChannelType {
  PUBLIC
  PRIVATE
  DM
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
}

enum MessageDeliveryStatus {
  SENDING
  SENT
  DELIVERED
  READ
  FAILED
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}
```

## 2. Feature Module Structure

### 2.1 User Module
```typescript
// src/features/users/types/user.types.ts
export interface User {
  id: string;
  email?: string;
  name?: string;
  imageUrl?: string;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// src/features/users/interfaces/user-repository.interface.ts
export interface IUserRepository extends IBaseRepository<User> {
  findByEmail(email: string): Promise<User>;
  updateOnlineStatus(id: string, isOnline: boolean): Promise<void>;
}
```

### 2.2 Channels Module
```typescript
// src/features/channels/types/channel.types.ts
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  createdById: string;
  createdAt: Date;
  lastActivityAt: Date;
  memberCount: number;
}

export interface ChannelMember {
  channelId: string;
  userId: string;
  role: MemberRole;
  lastReadAt: Date;
  joinedAt: Date;
  unreadCount: number;
}

export interface ChannelNavigation {
  id: string;
  userId: string;
  channelId: string;
  viewedAt: Date;
  order: number;
}

// src/features/channels/interfaces/channel-repository.interface.ts
export interface IChannelRepository extends IBaseRepository<Channel> {
  findMemberChannels(userId: string): Promise<Channel[]>;
  addMember(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember>;
  updateLastActivity(channelId: string): Promise<void>;
  updateMemberCount(channelId: string): Promise<void>;
}
```

### 2.3 Messages Module
```typescript
// src/features/messages/types/message.types.ts
export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentId?: string;
  replyCount: number;
  deliveryStatus: MessageDeliveryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

// src/features/messages/interfaces/message-repository.interface.ts
export interface IMessageRepository extends IBaseRepository<Message> {
  findByChannel(channelId: string, cursor?: string, limit?: number): Promise<Message[]>;
  findThread(parentId: string): Promise<Message[]>;
  updateDeliveryStatus(id: string, status: MessageDeliveryStatus): Promise<Message>;
  markAsRead(messageId: string, userId: string): Promise<ReadReceipt>;
}
```

### 2.4 Reactions Module
```typescript
// src/features/reactions/types/reaction.types.ts
export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

// src/features/reactions/interfaces/reaction-repository.interface.ts
export interface IReactionRepository extends IBaseRepository<Reaction> {
  findByMessage(messageId: string): Promise<Reaction[]>;
  findUserReaction(messageId: string, userId: string, emoji: string): Promise<Reaction>;
}
```

### 2.5 Attachments Module
```typescript
// src/features/attachments/types/attachment.types.ts
export interface Attachment {
  id: string;
  messageId: string;
  url: string;
  type: string;
  name: string;
  createdAt: Date;
}

// src/features/attachments/interfaces/attachment-repository.interface.ts
export interface IAttachmentRepository extends IBaseRepository<Attachment> {
  findByMessage(messageId: string): Promise<Attachment[]>;
}
```

### 2.6 Invitations Module
```typescript
// src/features/invitations/types/invitation.types.ts
export interface ChannelInvitation {
  id: string;
  channelId: string;
  userId: string;
  inviterId: string;
  role: MemberRole;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt?: Date;
}

// src/features/invitations/interfaces/invitation-repository.interface.ts
export interface IInvitationRepository extends IBaseRepository<ChannelInvitation> {
  findPendingByUser(userId: string): Promise<ChannelInvitation[]>;
  findByChannelAndUser(channelId: string, userId: string): Promise<ChannelInvitation>;
  updateStatus(id: string, status: InvitationStatus): Promise<ChannelInvitation>;
}
```

## 3. Feature Events

### 3.1 Channel Events
```typescript
// src/features/channels/events/channel.events.ts
export interface ChannelEvents {
  'channel:created': (channel: Channel) => void;
  'channel:updated': (channel: Channel) => void;
  'channel:member_joined': (data: ChannelMember) => void;
  'channel:member_left': (data: { channelId: string; userId: string }) => void;
  'channel:activity_updated': (data: { channelId: string; lastActivityAt: Date }) => void;
}
```

### 3.2 Message Events
```typescript
// src/features/messages/events/message.events.ts
export interface MessageEvents {
  'message:created': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string) => void;
  'message:status_updated': (data: { messageId: string; status: MessageDeliveryStatus }) => void;
  'message:read': (data: ReadReceipt) => void;
}
```

## 4. Repository Implementations

### 4.1 Channel Repository
```typescript
// src/features/channels/repositories/channel.repository.ts
@Injectable()
export class ChannelRepository implements IChannelRepository {
  constructor(private prisma: PrismaService) {}

  async findMemberChannels(userId: string): Promise<Channel[]> {
    return this.prisma.channel.findMany({
      where: {
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        members: true,
        _count: {
          select: { messages: true }
        }
      },
      orderBy: {
        lastActivityAt: 'desc'
      }
    });
  }

  async addMember(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember> {
    return this.prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role
      }
    });
  }

  async updateLastActivity(channelId: string): Promise<void> {
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { lastActivityAt: new Date() }
    });
  }
}
```

This organization:
1. Separates concerns by feature
2. Maintains existing functionality
3. Makes dependencies clear
4. Facilitates adding new features

Would you like me to:
1. Show service implementations for any feature?
2. Detail the event handling system?
3. Show how features interact?
