import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './lib/prisma.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { FilesModule } from './modules/files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ChannelsModule,
    MessagesModule,
    ThreadsModule,
    UsersModule,
    WebSocketModule,
    FilesModule,
  ],
})
export class AppModule {}
