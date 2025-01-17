import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

async function testEmbeddingAndStorage() {
  dotenv.config();
  
  try {
    // Initialize clients
    console.log('Initializing clients...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    // Create test message and generate embedding
    console.log('\nGenerating embedding for test message...');
    const testMessage = 'Test message about kubernetes pods and containers';
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: testMessage
    });
    console.log('✅ Generated embedding:', {
      dimensions: embedding.data[0].embedding.length,
      firstFew: embedding.data[0].embedding.slice(0, 3)
    });

    // Store in Pinecone
    console.log('\nStoring in Pinecone...');
    const indexName = 'chatgenius-1536';
    const index = pinecone.Index(indexName);
    
    const testVector = {
      id: 'test-vector-' + Date.now(),
      values: embedding.data[0].embedding,
      metadata: {
        content: testMessage,
        channelId: 'test_channel',
        userId: 'test_user_1',
        timestamp: new Date().toISOString()
      }
    };

    await index.upsert([testVector]);
    console.log('✅ Stored vector with ID:', testVector.id);

    // Query back the vector
    console.log('\nQuerying the vector back...');
    const queryResult = await index.query({
      vector: embedding.data[0].embedding,
      topK: 1,
      includeMetadata: true
    });

    console.log('Query results:', {
      matches: queryResult.matches?.length,
      firstMatch: queryResult.matches?.[0] ? {
        id: queryResult.matches[0].id,
        score: queryResult.matches[0].score,
        metadata: queryResult.matches[0].metadata
      } : null
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error details:', error);
  }
}

testEmbeddingAndStorage(); 