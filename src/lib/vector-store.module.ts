import { Module } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { PineconeService } from './pinecone.service';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';
import { TextChunkingService } from './text-chunking.service';
import { OpenAIService } from './openai.service';

@Module({
  imports: [ConfigModule],
  providers: [
    VectorStoreService,
    PineconeService,
    EmbeddingService,
    TextChunkingService,
    OpenAIService
  ],
  exports: [VectorStoreService, TextChunkingService]
})
export class VectorStoreModule {} 