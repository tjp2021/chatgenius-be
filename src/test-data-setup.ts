import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';

const TEST_MESSAGES = [
  {
    id: 'msg1',
    content: 'To reset your password, go to Settings > Security and click on "Reset Password". Follow the email instructions.',
  },
  {
    id: 'msg2',
    content: 'Channel permissions can be managed by admins and moderators. Go to Channel Settings > Permissions to modify roles.',
  },
  {
    id: 'msg3',
    content: 'To create a new thread, click the "+" button in any channel and select "New Thread". Add a title and description.',
  },
  {
    id: 'msg4',
    content: 'For enhanced security, we recommend enabling two-factor authentication in your account settings.',
  },
  {
    id: 'msg5',
    content: 'You can customize your notification settings per channel by clicking the channel settings gear icon.',
  },
];

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
    console.log('Generating embeddings for test messages...');
    const embeddings = await openAIService.generateEmbeddings(
      TEST_MESSAGES.map(msg => msg.content)
    );

    console.log('Storing vectors in Pinecone...');
    for (let i = 0; i < TEST_MESSAGES.length; i++) {
      await pineconeService.upsert(
        TEST_MESSAGES[i].id,
        embeddings[i],
        {
          content: TEST_MESSAGES[i].content,
          timestamp: new Date().toISOString(),
        }
      );
      console.log(`✓ Stored message ${i + 1}/${TEST_MESSAGES.length}`);
    }

    console.log('\n✅ Test data setup completed successfully!');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

main().catch(console.error); 