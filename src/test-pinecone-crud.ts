import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

async function testPineconeCRUD() {
  // Load environment variables
  dotenv.config();

  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Use the correct index name we discovered
    const indexName = 'chatgenius-1536';
    console.log(`Using index: ${indexName}`);
    const index = pinecone.index(indexName);

    // Test vector
    const testVector = {
      id: 'test-vector-1',
      values: Array(1536).fill(0).map(() => Math.random()), // Random 1536-dim vector
      metadata: {
        text: 'This is a test message',
        timestamp: new Date().toISOString(),
        messageId: 'test-message-1'
      }
    };

    console.log('\n1. Testing upsert...');
    await index.upsert([testVector]);
    console.log('✅ Upsert successful');

    console.log('\n2. Testing fetch...');
    const fetched = await index.fetch([testVector.id]);
    console.log('Fetched vector:', {
      id: testVector.id,
      metadata: fetched.records[testVector.id]?.metadata,
      dimensions: fetched.records[testVector.id]?.values.length
    });

    console.log('\n3. Testing query...');
    const queryResult = await index.query({
      vector: testVector.values,
      topK: 1,
      includeMetadata: true
    });
    console.log('Query results:', queryResult);

    console.log('\n4. Testing delete...');
    await index.deleteOne(testVector.id);
    console.log('✅ Delete successful');

    // Verify deletion
    const afterDelete = await index.fetch([testVector.id]);
    console.log('Vector after deletion:', afterDelete.records[testVector.id]);

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testPineconeCRUD(); 