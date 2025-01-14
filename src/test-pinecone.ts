import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PineconeService } from './lib/pinecone.service';

async function main() {
  // Create test module
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot()],
    providers: [PineconeService],
  }).compile();

  // Get service instance
  const pineconeService = moduleRef.get<PineconeService>(PineconeService);

  // Test data
  const testVector = {
    id: 'test-vector-1',
    vector: Array(1536).fill(0).map(() => Math.random()),
    metadata: {
      content: 'This is a test message',
      timestamp: new Date().toISOString(),
    },
  };

  try {
    // Test upsert
    console.log('Testing vector upsert...');
    await pineconeService.upsert(
      testVector.id,
      testVector.vector,
      testVector.metadata
    );
    console.log('✓ Vector upserted successfully');

    // Test query
    console.log('\nTesting vector query...');
    const results = await pineconeService.query({
      vector: testVector.vector,
      topK: 1,
      includeMetadata: true,
    });
    console.log('Query results:', results.matches);

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error); 