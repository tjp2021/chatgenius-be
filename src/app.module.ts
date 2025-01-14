import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SearchController } from './controllers/search.controller';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';
import { SearchService } from './lib/search.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController, SearchController],
  providers: [AppService, OpenAIService, PineconeService, SearchService],
})
export class AppModule {}
