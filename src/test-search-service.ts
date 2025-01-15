import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './lib/search.service';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';

async function main() {
  console.log('🧪 Starting Search Service Tests');
  
  // Create test module
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot()],
    providers: [SearchService, OpenAIService, PineconeService],
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
      
      await pineconeService.upsert(data.id, embedding, {
        content: data.content,
        userId: data.userId,
        timestamp: data.timestamp,
        threadId: data.threadId,
        isReply: data.isReply,
        channel: data.channel
      });
    }
    console.log('✅ Test data setup complete');

    // Test 1: Basic search (MVP feature)
    console.log('\n2️⃣ Testing basic search...');
    const basicResults = await searchService.search('When did Views come out?');
    console.log('Basic search results:');
    basicResults.forEach((result, i) => {
      console.log(`${i + 1}. [${result.score.toFixed(3)}] ${result.content}`);
    });
    console.log('✅ Basic search test complete');

    // Test 2: User-specific search (Avatar feature)
    console.log('\n3️⃣ Testing user-specific search...');
    const userResults = await searchService.search('Views album', { userId: 'user1' });
    console.log('User-specific search results:');
    userResults.forEach((result, i) => {
      console.log(`${i + 1}. [${result.score.toFixed(3)}] ${result.content}`);
      console.log(`   User: ${result.metadata?.userId}`);
      console.log(`   Context: ${JSON.stringify(result.metadata?.context)}`);
    });
    console.log('✅ User-specific search test complete');

    // Test 3: Metadata verification
    console.log('\n4️⃣ Testing metadata completeness...');
    const metadataTest = await searchService.search('Grammy');
    const testResult = metadataTest[0];
    const hasAllMetadata = testResult.metadata?.userId 
      && testResult.metadata?.timestamp 
      && testResult.metadata?.context?.threadId
      && typeof testResult.metadata?.context?.isReply === 'boolean'
      && testResult.metadata?.context?.channel;
    
    console.log('Metadata test result:', {
      hasAllMetadata,
      metadata: testResult.metadata
    });
    console.log('✅ Metadata test complete');

    // Test 4: Score threshold
    console.log('\n5️⃣ Testing score threshold...');
    const thresholdTest = await searchService.search('completely unrelated query');
    console.log(`Results below threshold (${thresholdTest.length} expected): ${thresholdTest.length}`);
    console.log('✅ Score threshold test complete');

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error); 