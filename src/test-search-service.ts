import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './lib/search.service';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';

async function main() {
  // Create test module
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot()],
    providers: [SearchService, OpenAIService, PineconeService],
  }).compile();

  // Get service instances
  const searchService = moduleRef.get<SearchService>(SearchService);

  // Test queries
  const queries = [
    'How do I reset my password?',
    'What are the channel permissions?',
    'How do I create a new thread?'
  ];

  for (const query of queries) {
    console.log(`\nSearching for: "${query}"`);
    try {
      const results = await searchService.search(query);
      
      console.log('Results:');
      results.forEach((result, i) => {
        console.log(`${i + 1}. [${result.score.toFixed(3)}] ${result.content}`);
      });
    } catch (error) {
      console.error('Search failed:', error.message);
    }
  }
}

main().catch(console.error); 