# ChatGenius Backend Migration Documentation

## Table of Contents
1. [Core Infrastructure Setup](#1-core-infrastructure-setup)
2. [Shared Module Setup](#2-shared-module-setup)
3. [Events System Setup](#3-events-system-setup)
4. [Feature Modules Setup](#4-feature-modules-setup)
5. [Database Schema Updates](#5-database-schema-updates)
6. [Migration Scripts](#6-migration-scripts)

## 1. Core Infrastructure Setup

### 1.1 Project Structure
```bash
src/
├── shared/
│   ├── types/
│   ├── interfaces/
│   ├── guards/
│   └── utils/
├── infrastructure/
│   ├── database/
│   ├── websocket/
│   └── cache/
├── events/
│   ├── socket/
│   └── emitter/
└── features/
    ├── channels/
    ├── messages/
    └── [future-features]/
```

### 1.2 Infrastructure Module
```typescript
// src/infrastructure/infrastructure.module.ts
@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    CacheModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        url: configService.get('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    PrismaService,
    CacheService,
    SocketService,
  ],
  exports: [
    PrismaService,
    CacheService,
    SocketService,
  ],
})
export class InfrastructureModule {}
```

### 1.3 Database Service
```typescript
// src/infrastructure/database/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

### 1.4 Cache Service
```typescript
// src/infrastructure/cache/cache.service.ts
@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return this.cacheManager.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }
}
```

## 2. Shared Module Setup

### 2.1 Base Interfaces
```typescript
// src/shared/interfaces/base-repository.interface.ts
export interface IBaseRepository<T> {
  findById(id: string): Promise<T>;
  findMany(params: any): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

// src/shared/interfaces/base-service.interface.ts
export interface IBaseService<T> {
  findById(id: string): Promise<T>;
  create(data: any): Promise<T>;
  update(id: string, data: any): Promise<T>;
  delete(id: string): Promise<boolean>;
}
```

### 2.2 Guards
```typescript
// src/shared/guards/clerk.guard.ts
@Injectable()
export class ClerkGuard implements CanActivate {
  private clerk: Clerk;

  constructor() {
    this.clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) return false;

    try {
      const decoded = await this.clerk.verifyToken(token);
      request.user = { id: decoded.sub };
      return true;
    } catch {
      return false;
    }
  }
}

// src/shared/guards/ws.guard.ts
@Injectable()
export class WsGuard implements CanActivate {
  private clerk: Clerk;

  constructor() {
    this.clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = client.handshake.auth.token;

    if (!token) return false;

    try {
      const decoded = await this.clerk.verifyToken(token);
      client.data.userId = decoded.sub;
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2.3 Decorators
```typescript
// src/shared/decorators/user.decorator.ts
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id;
  },
);

// src/shared/decorators/ws-user.decorator.ts
export const WsUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const client = ctx.switchToWs().getClient<Socket>();
    return client.data.userId;
  },
);
```

## 3. Events System Setup

### 3.1 Event Types
```typescript
// src/events/types/channel.events.ts
export interface ChannelEvents {
  'channel:created': (channel: Channel) => void;
  'channel:updated': (channel: Channel) => void;
  'channel:deleted': (channelId: string) => void;
  'channel:member_joined': (data: { channelId: string; userId: string }) => void;
  'channel:member_left': (data: { channelId: string; userId: string }) => void;
}

// src/events/types/message.events.ts
export interface MessageEvents {
  'message:created': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string) => void;
  'message:delivered': (data: { messageId: string; userId: string }) => void;
  'message:read': (data: { messageId: string; userId: string }) => void;
}
```

### 3.2 Event Service
```typescript
// src/events/emitter/event.service.ts
@Injectable()
export class EventService {
  private eventEmitter = new EventEmitter();

  emit<T>(event: string, data: T): void {
    this.eventEmitter.emit(event, data);
  }

  on<T>(event: string, listener: (data: T) => void): void {
    this.eventEmitter.on(event, listener);
  }

  removeListener(event: string, listener: Function): void {
    this.eventEmitter.removeListener(event, listener);
  }
}
```

### 3.3 Socket Gateway
```typescript
// src/events/socket/base.gateway.ts
@WebSocketGateway()
export class BaseGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    try {
      const userId = client.data.userId;
      await this.handleUserConnection(client, userId);
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      await this.handleUserDisconnect(client, userId);
    }
  }

  protected async handleUserConnection(client: Socket, userId: string) {
    client.join(`user:${userId}`);
  }

  protected async handleUserDisconnect(client: Socket, userId: string) {
    client.leave(`user:${userId}`);
  }
}
```

## 4. Feature Modules Setup

### 4.1 Channel Module
```typescript
// src/features/channels/channel.module.ts
@Module({
  imports: [
    InfrastructureModule,
    EventsModule
  ],
  providers: [
    ChannelService,
    ChannelRepository,
    ChannelHandler
  ],
  controllers: [ChannelController],
  exports: [ChannelService]
})
export class ChannelModule {}

// src/features/channels/channel.service.ts
@Injectable()
export class ChannelService {
  constructor(
    private repository: ChannelRepository,
    private eventService: EventService
  ) {}

  async createChannel(userId: string, data: CreateChannelDto) {
    const channel = await this.repository.create({
      ...data,
      creatorId: userId
    });

    this.eventService.emit('channel:created', channel);
    return channel;
  }
}
```

### 4.2 Message Module
```typescript
// src/features/messages/message.module.ts
@Module({
  imports: [
    InfrastructureModule,
    EventsModule
  ],
  providers: [
    MessageService,
    MessageRepository,
    MessageHandler
  ],
  controllers: [MessageController],
  exports: [MessageService]
})
export class MessageModule {}

// src/features/messages/message.service.ts
@Injectable()
export class MessageService {
  constructor(
    private repository: MessageRepository,
    private eventService: EventService
  ) {}

  async createMessage(userId: string, data: CreateMessageDto) {
    const message = await this.repository.create({
      ...data,
      userId
    });

    this.eventService.emit('message:created', message);
    return message;
  }
}
```

## 5. Database Schema Updates

### 5.1 Prisma Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Channel {
  id          String      @id @default(uuid())
  name        String
  type        ChannelType
  creatorId   String
  members     ChannelMember[]
  messages    Message[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([creatorId])
}

model Message {
  id        String   @id @default(uuid())
  content   String
  channelId String
  userId    String
  channel   Channel  @relation(fields: [channelId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([channelId])
  @@index([userId])
}
```

## 6. Migration Scripts

### 6.1 Database Migration
```bash
# Run this after updating schema
npx prisma migrate dev --name restructure_tables
```

### 6.2 Code Migration Steps
```bash
# 1. Create new directory structure
mkdir -p src/{shared,infrastructure,events,features/{channels,messages}}/{types,interfaces,repositories,services,handlers,api}

# 2. Move existing files
mv src/auth/guards/* src/shared/guards/
mv src/channels/* src/features/channels/
mv src/message/* src/features/messages/

# 3. Update imports
find src -type f -name "*.ts" -exec sed -i 's/@auth\/guards/@shared\/guards/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/@channels/@features\/channels/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/@message/@features\/messages/g' {} +

# 4. Install new dependencies if needed
npm install --save @nestjs/event-emitter
```

### 6.3 Environment Variables
```env
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/chatgenius"
REDIS_URL="redis://localhost:6379"
CLERK_SECRET_KEY="your_clerk_secret_key"
```

This documentation provides everything needed for the migration. Let me know if you need:
1. More detailed examples of any component
2. Specific migration steps for your current code
3. Testing strategies for the new structure