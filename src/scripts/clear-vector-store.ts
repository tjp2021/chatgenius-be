import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { VectorStoreService } from '../lib/vector-store.service';
import { OpenAIService } from '../lib/openai.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';
import { TextChunkingService } from '../lib/text-chunking.service';

async function main() {
  // Create test module for vector store dependencies
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot()],
    providers: [
      VectorStoreService,
      OpenAIService,
      PineconeService,
      EmbeddingService,
      TextChunkingService
    ],
  }).compile();

  const vectorStoreService = moduleRef.get<VectorStoreService>(VectorStoreService);

  try {
    console.log('Clearing vector store...');
    await vectorStoreService.clearVectors();
    console.log('✅ Vector store cleared successfully!');
  } catch (error) {
    console.error('Failed to clear vector store:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 