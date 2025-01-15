import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

async function testPinecone() {
  // Load environment variables
  dotenv.config();

  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // List indexes
    const indexes = await pinecone.listIndexes();
    console.log('Successfully connected to Pinecone!');
    console.log('Available indexes:', indexes);

  } catch (error) {
    console.error('Failed to connect to Pinecone:', error);
    process.exit(1);
  }
}

testPinecone(); 