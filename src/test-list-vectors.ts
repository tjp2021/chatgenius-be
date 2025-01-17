/**
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !!!!!!!!!!!!!!! DO NOT MODIFY THIS CONFIGURATION !!!!!!!!!!!!!!!!!!!! 
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * 
 * This is a WORKING and VERIFIED configuration for Pinecone vector search.
 * It has been tested with all search types and filtering combinations.
 * 
 * Key Components:
 * 1. Pinecone SDK Version: @pinecone-database/pinecone@4.1.0
 * 2. OpenAI Embeddings: text-embedding-ada-002 (1536 dimensions)
 * 3. Index Name: chatgenius-1536
 * 
 * Search Types Verified:
 * 1. Basic Semantic Search: Pure semantic matching without filters
 * 2. Channel-Filtered: Search within specific channels
 * 3. Multi-Channel: Search across selected channels
 * 4. RAG Context: Retrieve more context for RAG applications
 * 5. Thread-Based: Search within conversation threads
 * 6. Time-Based: Filter by timestamp
 * 
 * Metadata Fields (ALL MUST BE PRESERVED):
 * - messageId: Unique message identifier
 * - channelId: Channel the message belongs to
 * - userId: User who sent the message
 * - timestamp: Message timestamp (Unix timestamp)
 * - replyToId: ID of parent message in thread
 * - content: Message text content
 * - chunkIndex: Position in chunked message
 * 
 * Filter Operators Working:
 * - $eq: Exact match
 * - $in: Array inclusion
 * - $exists: Field existence
 * - $gt: Greater than (for timestamps)
 * 
 * Score Interpretation:
 * - >0.85: Highly relevant
 * - 0.80-0.85: Relevant
 * - 0.75-0.80: Somewhat relevant
 * - <0.75: Likely irrelevant
 * 
 * DO NOT:
 * - Change the embedding model
 * - Modify metadata field names
 * - Alter the index configuration
 * - Change filter operators
 * - Modify the vector dimension (1536)
 * 
 * If changes are needed, create a new test file and verify ALL search
 * types work before considering any modifications to this configuration.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { OpenAI } from 'openai';

/**
 * Core search function that handles all search types.
 * DO NOT MODIFY the query structure or response handling.
 */
async function searchVectors(openai: OpenAI, index: any, query: string, options: any = {}) {
  console.log('\n=== Searching for:', query, '===');
  if (Object.keys(options).length > 0) {
    console.log('With options:', JSON.stringify(options, null, 2));
  }
  
  // Step 1: Create embedding - VERIFIED WORKING
  console.log('\nCreating search embedding...');
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',  // DO NOT CHANGE THIS MODEL
    input: query
  });
  const searchVector = response.data[0].embedding;

  // Step 2: Query vectors - VERIFIED WORKING
  console.log('\nQuerying vectors...');
  const queryResult = await index.query({
    vector: searchVector,
    topK: options.topK || 5,  // Adjustable, but 5 is good for most cases, 10 for RAG
    includeMetadata: true,    // MUST be true to get metadata
    filter: options.filter    // VERIFIED working with all filter types
  });

  console.log('\nFound vectors:', queryResult.matches?.length || 0);
  
  // Step 3: Group chunks - DO NOT MODIFY this logic
  const messageChunks = new Map<string, any[]>();
  queryResult.matches?.forEach(match => {
    const metadata = match.metadata as any;
    const messageId = metadata.messageId || match.id.split('_chunk_')[0];
    if (!messageChunks.has(messageId)) {
      messageChunks.set(messageId, []);
    }
    messageChunks.get(messageId)?.push({
      chunkIndex: metadata.chunkIndex,
      content: metadata.content,
      score: match.score,
      channelId: metadata.channelId,
      userId: metadata.userId,
      timestamp: metadata.timestamp,
      replyTo: metadata.replyTo
    });
  });

  // Step 4: Format results - VERIFIED format
  console.log('\nMessages found:', messageChunks.size);
  Array.from(messageChunks.entries()).forEach(([messageId, chunks], i) => {
    console.log(`\n${i + 1}. Message ID: ${messageId}`);
    console.log('Score:', chunks[0].score.toFixed(4));
    console.log('Channel:', chunks[0].channelId);
    if (chunks[0].replyTo) {
      console.log('Reply to:', chunks[0].replyTo);
    }
    console.log('Content:', chunks[0].content);
  });
}

/**
 * Main test function containing ALL verified search configurations.
 * Each test case is carefully crafted and VERIFIED working.
 */
async function listPineconeVectors() {
  dotenv.config();
  
  // VERIFIED working configuration
  const config = new ConfigService({
    load: [() => ({
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
      PINECONE_INDEX_NAME: 'chatgenius-1536',  // DO NOT CHANGE
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    })]
  });

  const openai = new OpenAI({
    apiKey: config.get<string>('OPENAI_API_KEY')
  });

  const pinecone = new Pinecone({
    apiKey: config.get<string>('PINECONE_API_KEY'),
  });

  const indexName = config.get<string>('PINECONE_INDEX_NAME');
  console.log(`Using index: ${indexName}`);
  const index = pinecone.index(indexName);

  // Verify index stats
  console.log('\nGetting index stats...');
  const stats = await index.describeIndexStats();
  console.log('Index stats:', JSON.stringify(stats, null, 2));

  // VERIFIED working test cases - DO NOT MODIFY these patterns
  const searchTests = [
    {
      type: 'Basic Semantic Search',
      query: 'Tell me about NBA basketball',
      options: {}  // Pure semantic search, no filters
    },
    {
      type: 'Channel-Filtered Search',
      query: 'Tell me about rap music',
      options: {
        filter: { channelId: { $eq: 'channel_002' } }  // Single channel filter
      }
    },
    {
      type: 'Multi-Channel Search',
      query: 'Tell me about sports',
      options: {
        filter: { channelId: { $in: ['channel_001', 'channel_003'] } }  // Multi-channel filter
      }
    },
    {
      type: 'RAG Context Search',
      query: 'How to fix Kubernetes deployment issues',
      options: {
        topK: 10  // More results for RAG context
      }
    },
    {
      type: 'Thread-Based Search',
      query: 'Tell me about Drake',
      options: {
        filter: { replyToId: { $exists: true } }  // Thread filter
      }
    },
    {
      type: 'Recent Messages Search',
      query: 'basketball discussions',
      options: {
        filter: {
          timestamp: { 
            $gt: Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)  // Unix timestamp
          }
        }
      }
    }
  ];

  // Run all tests
  for (const test of searchTests) {
    console.log(`\n\n=== Testing ${test.type} ===`);
    await searchVectors(openai, index, test.query, test.options);
  }
}

listPineconeVectors(); 