import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { OpenAIModule } from './lib/openai.module';
import { OpenAIService } from './lib/openai.service';

async function testOpenAIService() {
  try {
    // Create a test module with configuration
    const app = await NestFactory.createApplicationContext({
      module: class TestModule {},
      imports: [
        ConfigModule.forRoot(),
        OpenAIModule,
      ],
    });

    const openaiService = app.get(OpenAIService);

    // Test single embedding
    console.log('\nTesting single embedding generation...');
    const text = "Hello, this is a test message.";
    const embedding = await openaiService.generateEmbedding(text);
    console.log('✓ Generated embedding with dimensions:', embedding.length);

    // Test batch embedding
    console.log('\nTesting batch embedding generation...');
    const texts = [
      "First test message",
      "Second test message",
      "Third test message"
    ];
    const embeddings = await openaiService.generateEmbeddings(texts);
    console.log('✓ Generated embeddings for', embeddings.length, 'texts');
    console.log('Dimensions:', embeddings[0].length);

    await app.close();
    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testOpenAIService(); 