import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './modules/search/services/search.service';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';
import { MessagesService } from './modules/messages/services/messages.service';
import { PrismaService } from './lib/prisma.service';
import { VectorStoreService } from './lib/vector-store.service';
import { ResponseSynthesisService } from './lib/response-synthesis.service';

async function main() {
  console.log('🧪 Starting Search Service Tests');
  
  // Create test module
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot()],
    providers: [
      SearchService,
      OpenAIService,
      PineconeService,
      MessagesService,
      PrismaService,
      VectorStoreService,
      ResponseSynthesisService
    ],
  }).compile();

  // Get service instances
  const searchService = moduleRef.get<SearchService>(SearchService);
  const pineconeService = moduleRef.get<PineconeService>(PineconeService);

  // Test data setup
  const testData = [
    {
      id: 'msg1',
      content: 'Drake released Views in 2016',
      userId: 'user1',
      timestamp: '2024-01-14T00:00:00Z',
      threadId: 'thread1',
      isReply: false,
      channel: 'music'
    },
    {
      id: 'msg2',
      content: 'Views is considered one of Drake\'s best albums',
      userId: 'user1',
      timestamp: '2024-01-14T00:01:00Z',
      threadId: 'thread1',
      isReply: true,
      channel: 'music'
    },
    {
      id: 'msg3',
      content: 'Drake has won multiple Grammy awards',
      userId: 'user2',
      timestamp: '2024-01-14T00:02:00Z',
      threadId: 'thread2',
      isReply: false,
      channel: 'music'
    }
  ];

  try {
    console.log('\n1️⃣ Setting up test data...');
    for (const data of testData) {
      const embedding = await moduleRef
        .get<OpenAIService>(OpenAIService)
        .generateEmbedding(data.content);
      
      await pineconeService.upsertVector(data.id, embedding, {
        content: data.content,
        userId: data.userId,
        timestamp: data.timestamp,
        threadId: data.threadId,
        isReply: data.isReply,
        channel: data.channel
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 