import { PrismaClient } from '@prisma/client';
import { VectorStoreService } from './lib/vector-store.service';
import { PineconeService } from './lib/pinecone.service';
import { EmbeddingService } from './lib/embedding.service';
import { TextChunkingService } from './lib/text-chunking.service';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

async function syncVectors() {
  dotenv.config();
  
  const prisma = new PrismaClient();
  const config = new ConfigService({
    load: [() => ({
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
      PINECONE_INDEX_NAME: 'chatgenius-1536',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    })]
  });
  const pinecone = new PineconeService(config);
  const embedding = new EmbeddingService(config);
  const textChunking = new TextChunkingService();
  const vectorStore = new VectorStoreService(pinecone, embedding, textChunking);

  try {
    // Get all messages
    console.log('Fetching messages from database...');
    const messages = await prisma.message.findMany({
      include: {
        user: true,
        channel: true
      }
    });
    console.log(`Found ${messages.length} messages`);

    // Convert to vector store format
    const vectorMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      metadata: {
        channelId: msg.channelId,
        userId: msg.userId,
        timestamp: msg.createdAt.toISOString(),
        replyToId: msg.replyToId
      }
    }));

    // Store in batches of 10
    console.log('\nStoring vectors...');
    const batchSize = 10;
    for (let i = 0; i < vectorMessages.length; i += batchSize) {
      const batch = vectorMessages.slice(i, i + batchSize);
      await vectorStore.storeMessageBatch(batch);
      console.log(`Processed ${Math.min(i + batchSize, vectorMessages.length)}/${vectorMessages.length} messages`);
    }

    console.log('\n✅ All vectors synced successfully');
  } catch (error) {
    console.error('Error syncing vectors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncVectors(); 