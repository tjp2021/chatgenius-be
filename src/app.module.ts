import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SearchController } from './controllers/search.controller';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';
import { SearchService } from './lib/search.service';
import { DataController } from './controllers/data.controller';
import { AiService } from './lib/ai.service';
import { AiController } from './controllers/ai.controller';
import { PrismaModule } from './lib/prisma.module';
import { WebSocketModule } from './modules/websocket/websocket.module';

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
  ],
  controllers: [AppController, SearchController, DataController, AiController],
  providers: [AppService, OpenAIService, PineconeService, SearchService, AiService],
})
export class AppModule {}
