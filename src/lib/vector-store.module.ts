import { Module } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { PineconeService } from './pinecone.service';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [VectorStoreService, PineconeService, EmbeddingService],
  exports: [VectorStoreService]
})
export class VectorStoreModule {} 