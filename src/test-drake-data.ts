import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';
import { Pinecone } from '@pinecone-database/pinecone';

const DRAKE_TEST_MESSAGES = [
  // Facts
  {
    id: 'fact1',
    content: 'Views was released on April 29, 2016 and debuted at number one on the Billboard 200.',
  },
  {
    id: 'fact2',
    content: 'Scorpion broke streaming records with over 1 billion streams in its first week of release.',
  },
  {
    id: 'fact3',
    content: 'Drake has won 4 Grammy Awards from 47 nominations throughout his career.',
  },
  {
    id: 'fact4',
    content: 'Drake became the first artist to surpass 50 billion streams on Spotify in 2021.',
  },
  {
    id: 'fact5',
    content: 'Drake holds the record for most Billboard Hot 100 entries ever with over 250 songs charting.',
  },

  // Opinions
  {
    id: 'opinion1',
    content: 'Drake revolutionized hip-hop by seamlessly switching between melodic singing and technical rapping.',
  },
  {
    id: 'opinion2',
    content: 'Drake changed rap by making emotional vulnerability and personal relationships central themes.',
  },
  {
    id: 'opinion3',
    content: 'Drake\'s influence on modern hip-hop sound is unmatched, creating the Toronto sound.',
  },
  {
    id: 'opinion4',
    content: 'Drake\'s melodic rap style created the blueprint that modern hip-hop artists follow.',
  },
  {
    id: 'opinion5',
    content: 'Drake\'s ability to create viral moments and memes changed how rappers interact with fans.',
  },

  // Comparisons
  {
    id: 'compare1',
    content: 'Unlike 90s rappers who focused on street credibility, Drake built his career on emotional honesty.',
  },
  {
    id: 'compare2',
    content: 'While Jay-Z focused on business success, Drake focused on relatable personal experiences.',
  },
  {
    id: 'compare3',
    content: 'Drake achieved mainstream success faster than any rapper before him in the streaming era.',
  },
  {
    id: 'compare4',
    content: 'Unlike traditional rappers, Drake started in television before music, changing the path to rap success.',
  },
  {
    id: 'compare5',
    content: 'Drake\'s social media presence changed artist-fan relationships more than any previous rapper.',
  },

  // Questions
  {
    id: 'question1',
    content: 'What makes Drake different from other rappers in terms of his musical style?',
  },
  {
    id: 'question2',
    content: 'Why has Drake been so successful in the streaming era?',
  },
  {
    id: 'question3',
    content: 'How did Drake change the sound of modern hip-hop?',
  },
  {
    id: 'question4',
    content: 'What is considered Drake\'s best album and why?',
  },
  {
    id: 'question5',
    content: 'How has Drake influenced the next generation of rappers?',
  },

  // Answers
  {
    id: 'answer1',
    content: 'Drake\'s unique ability to blend emotional singing with technical rap skills sets him apart from traditional rappers.',
  },
  {
    id: 'answer2',
    content: 'Drake dominates streaming because he understands playlist culture and consistently releases music that works in multiple contexts.',
  },
  {
    id: 'answer3',
    content: 'Drake changed hip-hop by popularizing melodic rap and making emotional vulnerability acceptable in mainstream rap.',
  },
  {
    id: 'answer4',
    content: 'Take Care is often considered Drake\'s best album because it perfectly balances rap skills with R&B elements while maintaining emotional depth.',
  },
  {
    id: 'answer5',
    content: 'Drake influenced modern rappers by showing how to blend genres, express emotions, and maintain mainstream appeal while keeping hip-hop credibility.',
  },
];

// Utility function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Utility function to chunk array
const chunk = <T>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
};

async function main() {
  // Create test module
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot()],
    providers: [OpenAIService, PineconeService],
  }).compile();

  // Get service instances
  const openAIService = moduleRef.get<OpenAIService>(OpenAIService);
  const pineconeService = moduleRef.get<PineconeService>(PineconeService);

  try {
    // Initialize Pinecone directly
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const indexName = 'chatgenius-1536';
    const index = pinecone.index(indexName);

    // Verify index exists
    console.log('Verifying index...');
    const indexes = await pinecone.listIndexes();
    console.log('Available indexes:', indexes.indexes.map(i => i.name));
    if (!indexes.indexes.find(i => i.name === indexName)) {
      throw new Error(`Index ${indexName} not found!`);
    }
    console.log('✓ Index verified');

    // Clear existing index
    console.log('Clearing existing index...');
    await index.deleteAll();
    await wait(5000); // Increased wait after clearing
    console.log('✓ Index cleared');

    // Generate embeddings
    console.log('\nGenerating embeddings for Drake test messages...');
    const embeddings = await openAIService.generateEmbeddings(
      DRAKE_TEST_MESSAGES.map(msg => msg.content)
    );
    console.log(`✓ Generated ${embeddings.length} embeddings`);
    console.log(`First embedding dimensions: ${embeddings[0].length}`);

    // Prepare vectors for batch insertion
    const vectors = DRAKE_TEST_MESSAGES.map((msg, i) => ({
      id: msg.id,
      values: embeddings[i],
      metadata: {
        content: msg.content,
        category: msg.id.split(/\d/)[0],
        timestamp: new Date().toISOString(),
      }
    }));

    // Store vectors in batches
    console.log('\nStoring vectors in Pinecone...');
    const BATCH_SIZE = 5;
    const batches = chunk(vectors, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await index.upsert(batch);
      console.log(`✓ Stored batch ${i + 1}/${batches.length} (${batch.length} vectors)`);
      await wait(2000); // Increased wait between batches
    }

    // Verify total count
    await wait(10000); // Increased wait before checking stats
    const stats = await index.describeIndexStats();
    console.log('\nIndex stats:', stats);

    if (stats.totalRecordCount !== DRAKE_TEST_MESSAGES.length) {
      throw new Error(`Expected ${DRAKE_TEST_MESSAGES.length} vectors, but found ${stats.totalRecordCount}`);
    }
    console.log(`✓ Verified total vector count: ${stats.totalRecordCount}`);

    // Test Queries
    const testQueries = [
      // Exact matches
      "When did Views come out?",
      "How many Grammys has Drake won?",
      
      // Semantic variations
      "When was Views released?",
      "Tell me about Drake's Grammy awards",
      
      // Complex questions
      "What makes Drake's music style unique compared to 90s rap?",
      "How has Drake's background in television affected his rap career?",
      
      // Irrelevant queries
      "What is Drake's favorite food?",
      "Where did Drake go to high school?",
      
      // Ambiguous queries
      "Drake's influence",
      "Drake music",
      
      // Short queries
      "Views",
      "Drake",
      
      // Noisy queries
      "uhh tell me about drake please",
      "i think drake is like really good at music right?"
    ];

    console.log('\nTesting search queries...');
    for (const query of testQueries) {
      console.log(`\nProcessing query: "${query}"`);
      
      const embedding = await openAIService.generateEmbedding(query);
      console.log(`Generated query embedding (${embedding.length} dimensions)`);

      const results = await index.query({
        vector: embedding,
        topK: 3,
        includeMetadata: true,
      });

      console.log(`Found ${results.matches.length} matches:`);
      results.matches.forEach((match, i) => {
        console.log(`\n${i + 1}. Score: ${match.score.toFixed(3)}`);
        console.log(`   ID: ${match.id}`);
        console.log(`   Category: ${match.metadata.category}`);
        console.log(`   Content: ${match.metadata.content}`);
        // Add score threshold warning
        if (match.score < 0.8) {
          console.log(`   ⚠️ Low confidence match (score < 0.8)`);
        }
      });
    }

    // Add result analysis
    console.log('\n📊 Search Quality Analysis:');
    console.log('- Exact matches should score > 0.85');
    console.log('- Semantic variations should score > 0.80');
    console.log('- Irrelevant queries should score < 0.75');
    console.log('- Short/noisy queries may need special handling\n');

    console.log('\n✅ Drake test data setup and validation completed successfully!');
  } catch (error) {
    console.error('Setup failed:', error);
    console.error('Error details:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error); 