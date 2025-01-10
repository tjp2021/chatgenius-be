# Complete Configuration and Types Documentation

## 1. Core Configuration

### 1.1 Environment Configuration
```typescript
// src/config/env.config.ts
export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  DIRECT_URL: string;
  CLERK_SECRET_KEY: string;
  REDIS_URL?: string;
  UPLOAD_BUCKET?: string;
  AWS_REGION?: string;
}

export const envConfig = () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  aws: {
    region: process.env.AWS_REGION,
    bucket: process.env.UPLOAD_BUCKET,
  },
});

// src/config/env.validation.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),
  CLERK_SECRET_KEY: Joi.string().required(),
  REDIS_URL: Joi.string().optional(),
  UPLOAD_BUCKET: Joi.string().optional(),
  AWS_REGION: Joi.string().optional(),
});
```

### 1.2 Configuration Module
```typescript
// src/config/config.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      validationSchema,
    }),
  ],
})
export class AppConfigModule {}
```

## 2. Core Types

### 2.1 Base Types
```typescript
// src/shared/types/common.types.ts
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// src/shared/types/enums.ts
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum ChannelType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  DM = 'DM',
}

export enum MemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum MessageDeliveryStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}
```

### 2.2 Auth Types
```typescript
// src/shared/types/auth.types.ts
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

export interface JwtPayload {
  sub: string;
  email?: string;
}

// src/shared/types/websocket.types.ts
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  user: AuthUser;
  rooms: Set<string>;
}
```

## 3. Feature Types

### 3.1 Channel Types
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

// DTOs
export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberIds?: string[];
}

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

### 3.2 Message Types
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

// DTOs
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
```

### 3.3 Attachment Types
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

// DTOs
export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}
```

### 3.4 Invitation Types
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

// DTOs
export class CreateInvitationDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole = MemberRole.MEMBER;

  @IsDate()
  @IsOptional()
  expiresAt?: Date;
}
```

## 4. WebSocket Event Types

### 4.1 Socket Events
```typescript
// src/shared/types/socket.types.ts
export interface ServerToClientEvents {
  'channel:created': (channel: Channel) => void;
  'channel:updated': (channel: Channel) => void;
  'channel:deleted': (channelId: string) => void;
  'message:created': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string) => void;
  'message:status': (data: { messageId: string; status: MessageDeliveryStatus }) => void;
  'user:typing': (data: { channelId: string; userId: string }) => void;
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;
}

export interface ClientToServerEvents {
  'message:send': (data: CreateMessageDto) => void;
  'message:update': (data: { messageId: string; content: string }) => void;
  'message:delete': (messageId: string) => void;
  'typing:start': (channelId: string) => void;
  'typing:stop': (channelId: string) => void;
}
```

These type definitions:
1. Ensure type safety across the application
2. Support the modular architecture
3. Make dependencies explicit
4. Facilitate easy feature additions

Would you like me to:
1. Show implementation examples using these types?
2. Add more specific types for any feature?
3. Detail how to use these types in services or controllers?