import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

async function clearPineconeVectors() {
  dotenv.config();
  
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = 'chatgenius-1536';
  console.log(`Using index: ${indexName}`);
  const index = pinecone.index(indexName);

  console.log('\nClearing all vectors...');
  await index.deleteAll();
  console.log('✅ All vectors cleared successfully');
}

clearPineconeVectors(); 