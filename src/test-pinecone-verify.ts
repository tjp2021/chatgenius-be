import { ConfigService } from '@nestjs/config';
import { PineconeService } from './lib/pinecone.service';
import * as dotenv from 'dotenv';

async function verifyPinecone() {
  dotenv.config();
  
  const config = new ConfigService({
    load: [() => ({
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
      PINECONE_INDEX_NAME: 'chatgenius-1536',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    })]
  });

  const pinecone = new PineconeService(config);

  try {
    // Test vector
    const testVector = {
      id: 'test-vector-1',
      values: Array(1536).fill(0.1), // Simple test vector
      metadata: {
        text: 'This is a test message',
        timestamp: new Date().toISOString()
      }
    };

    console.log('1. Testing upsert...');
    await pinecone.upsertVector(testVector.id, testVector.values, testVector.metadata);
    console.log('✅ Upsert successful');

    console.log('\n2. Testing fetch...');
    const fetched = await pinecone.getVectorById(testVector.id);
    console.log('Fetched vector:', {
      id: testVector.id,
      metadata: fetched?.metadata,
      dimensions: fetched?.values.length
    });

    console.log('\n3. Testing query...');
    const queryResult = await pinecone.queryVectors(testVector.values, 1);
    console.log('Query results:', queryResult);

    console.log('\n✅ All basic operations working!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyPinecone(); 