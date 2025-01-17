import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataController } from './controllers/data.controller';
import { AiService } from './lib/ai.service';
import { AiController } from './controllers/ai.controller';
import { PrismaModule } from './lib/prisma.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { UsersModule } from './modules/users/users.module';
import { MessagesModule } from './modules/messages/messages.module';
import { FilesModule } from './modules/files/files.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { VectorStoreModule } from './lib/vector-store.module';
import { AvatarModule } from './modules/avatar/avatar.module';
import { ResponseSynthesisModule } from './lib/response-synthesis.module';
import { SearchModule } from './modules/search/search.module';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// WEBSOCKET MODULE CONFIGURATION - DO NOT MODIFY
// The WebSocketModule import is required and configured correctly
// Removing or modifying this import will break real-time functionality
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

/* DONT FUCKING TOUCH THIS MODULE. IT IS THE MAIN MODULE FOR THE SERVER. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    WebSocketModule,
    ThreadsModule,
    UsersModule,
    MessagesModule,
    FilesModule,
    ChannelsModule,
    VectorStoreModule,
    AvatarModule,
    ResponseSynthesisModule,
    SearchModule
  ],
  controllers: [AppController, DataController, AiController],
  providers: [
    AppService,
    AiService
  ],
})
export class AppModule {}
