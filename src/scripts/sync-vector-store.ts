import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { VectorStoreService } from '../lib/vector-store.service';
import { OpenAIService } from '../lib/openai.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';
import { TextChunkingService } from '../lib/text-chunking.service';

const prisma = new PrismaClient();

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
    // Get all messages from the database
    console.log('\nFetching messages from database...');
    const messages = await prisma.message.findMany({
      include: {
        channel: true,
        user: true,
      }
    });
    console.log(`Found ${messages.length} messages`);

    // Store messages in vector store in batches
    console.log('\nStoring messages in vector store...');
    const BATCH_SIZE = 10;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(messages.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (message) => {
        try {
          await vectorStoreService.storeMessage(
            message.id,
            message.content,
            {
              channelId: message.channelId,
              userId: message.userId,
              timestamp: message.createdAt.toISOString(),
              replyToId: message.replyToId || undefined,
            }
          );
          console.log(`✓ Stored message ${message.id}`);
        } catch (error) {
          console.error(`Failed to store message ${message.id}:`, error);
        }
      }));

      // Wait a bit between batches to avoid rate limits
      if (i + BATCH_SIZE < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n✅ Vector store sync completed successfully!');
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 