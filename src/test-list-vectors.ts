import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

async function listPineconeVectors() {
  dotenv.config();
  
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = 'chatgenius-1536';
  console.log(`Using index: ${indexName}`);
  const index = pinecone.index(indexName);

  // Query first 10 vectors
  console.log('\nQuerying vectors...');
  const queryResult = await index.query({
    vector: Array(1536).fill(0.1),
    topK: 10,
    includeMetadata: true
  });

  console.log('\nFound vectors:', queryResult.matches?.length || 0);
  console.log('\nVector details:');
  queryResult.matches?.forEach((match, i) => {
    console.log(`\n${i + 1}. Vector ID: ${match.id}`);
    console.log('Metadata:', JSON.stringify(match.metadata, null, 2));
    console.log('Score:', match.score);
  });
}

listPineconeVectors(); 