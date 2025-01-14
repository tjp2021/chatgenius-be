import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

async function testEmbeddingAndSearch() {
  // Load environment variables
  dotenv.config();

  try {
    // Initialize clients
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = 'chatgenius-1536';  // Using new index
    console.log(`Using index: ${indexName}`);

    // Test messages
    const messages = [
      "Hello, how do I reset my password?",
      "To reset your password, go to Settings and click Reset Password.",
      "Where can I find the settings menu?",
    ];

    console.log('\n1. Generating embeddings for messages...');
    const embeddings = await Promise.all(
      messages.map(async (message, i) => {
        const response = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: message,
        });
        return {
          id: `test-msg-${i}`,
          values: response.data[0].embedding,
          metadata: {
            text: message,
            timestamp: new Date().toISOString()
          }
        };
      })
    );
    console.log('✓ Generated embeddings for', embeddings.length, 'messages');

    // Store in Pinecone
    console.log('\n2. Storing vectors in Pinecone...');
    const index = pinecone.index(indexName);
    await index.upsert(embeddings);
    console.log('✓ Stored vectors in Pinecone');

    // Generate query embedding
    console.log('\n3. Testing search...');
    const queryText = "How do I change my password?";
    const queryResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: queryText,
    });
    const queryEmbedding = queryResponse.data[0].embedding;

    // Search in Pinecone
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 2,
      includeMetadata: true
    });

    console.log('\nSearch Results for:', queryText);
    console.log('Matches:');
    searchResults.matches.forEach((match, i) => {
      console.log(`${i + 1}. Score: ${match.score.toFixed(3)}`);
      console.log(`   Text: ${match.metadata.text}`);
    });

    // Cleanup
    console.log('\n4. Cleaning up test data...');
    await index.deleteMany(embeddings.map(e => e.id));
    console.log('✓ Deleted test vectors');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testEmbeddingAndSearch(); 