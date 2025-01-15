import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

async function createIndex() {
  // Load environment variables
  dotenv.config();

  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = 'chatgenius-1536';

    console.log(`Creating index: ${indexName}`);
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });

    console.log('Waiting for index to be ready...');
    // Wait for index to be ready
    let isReady = false;
    while (!isReady) {
      const description = await pinecone.describeIndex(indexName);
      isReady = description.status.ready;
      if (!isReady) {
        console.log('Index not ready yet, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    console.log('✓ Index created successfully!');
    console.log('\nIndex details:');
    const description = await pinecone.describeIndex(indexName);
    console.log(JSON.stringify(description, null, 2));

  } catch (error) {
    console.error('Failed to create index:', error);
    process.exit(1);
  }
}

createIndex(); 