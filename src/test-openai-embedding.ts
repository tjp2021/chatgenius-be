import OpenAI from 'openai';
import * as dotenv from 'dotenv';

async function testEmbedding() {
  // Load environment variables
  dotenv.config();

  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test message
    const testMessage = "Hello, this is a test message to check embedding generation.";
    console.log('\nGenerating embedding for message:', testMessage);

    // Generate embedding
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: testMessage,
    });

    console.log('\nEmbedding generated successfully!');
    console.log('Dimensions:', response.data[0].embedding.length);
    console.log('Model:', response.model);
    console.log('Usage tokens:', response.usage);

    // Show first few dimensions as sample
    console.log('\nFirst 5 dimensions:', response.data[0].embedding.slice(0, 5));

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testEmbedding(); 