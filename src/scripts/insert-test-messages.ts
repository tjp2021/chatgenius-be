import { PrismaClient } from '@prisma/client';
import { VectorStoreService } from '../lib/vector-store.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';
import { TextChunkingService } from '../lib/text-chunking.service';
import { ConfigService } from '@nestjs/config';

const prisma = new PrismaClient();

// Initialize config service
const configService = new ConfigService();

// Initialize services
const embeddingService = new EmbeddingService(configService);
const pineconeService = new PineconeService(configService);
const textChunkingService = new TextChunkingService();
const vectorStore = new VectorStoreService(pineconeService, embeddingService, textChunkingService);

async function main() {
  // Create test users if they don't exist
  const user1 = await prisma.user.upsert({
    where: { id: 'test_user_1' },
    update: {},
    create: {
      id: 'test_user_1',
      name: 'Test User 1',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { id: 'test_user_2' },
    update: {},
    create: {
      id: 'test_user_2',
      name: 'Test User 2',
    },
  });

  // Create test channel if it doesn't exist
  const channel = await prisma.channel.upsert({
    where: { id: 'test_channel' },
    update: {},
    create: {
      id: 'test_channel',
      name: 'Test Channel',
      type: 'PUBLIC',
      createdBy: {
        connect: {
          id: user1.id
        }
      }
    },
  });

  // Add users to channel
  await prisma.channelMember.createMany({
    data: [
      { channelId: channel.id, userId: user1.id },
      { channelId: channel.id, userId: user2.id },
    ],
    skipDuplicates: true,
  });

  // Test messages covering different scenarios
  const messages = [
    // Technical discussion about deployment
    {
      content: "Our deployment process uses Docker containers orchestrated with Kubernetes. The pipeline goes through dev, staging, and prod environments.",
      userId: user1.id,
    },
    {
      content: "For local development, you can use minikube. First, install it using brew install minikube, then start it with minikube start.",
      userId: user2.id,
    },
    {
      content: "We use GitHub Actions for CI/CD. Every PR triggers tests and builds a new container image.",
      userId: user1.id,
    },

    // Error handling discussion
    {
      content: "I'm getting a 503 error in production after the latest deployment. Any ideas?",
      userId: user2.id,
    },
    {
      content: "Check the pod logs. Might be a memory issue. Run kubectl logs <pod-name> to investigate.",
      userId: user1.id,
    },
    {
      content: "Found the issue - one of our services was OOMKilled. We need to increase the memory limit in the deployment yaml.",
      userId: user2.id,
    },

    // Feature discussion
    {
      content: "We should add rate limiting to our API endpoints. Getting too many requests in prod.",
      userId: user1.id,
    },
    {
      content: "Good idea. We can use Redis for rate limiting. Here's a simple implementation using the rate-limiter-flexible package: [code example]",
      userId: user2.id,
    },
    {
      content: "Let's also add retry logic with exponential backoff for failed requests.",
      userId: user1.id,
    },

    // Documentation discussion
    {
      content: "Our API documentation needs updating. The /users endpoint has new fields that aren't documented.",
      userId: user2.id,
    },
    {
      content: "I'll update the Swagger docs. We should also add examples for the new pagination parameters.",
      userId: user1.id,
    },
    {
      content: "Remember to document the rate limits and error responses too.",
      userId: user2.id,
    }
  ];

  // Insert messages and vectorize them
  for (const msg of messages) {
    const createdMessage = await prisma.message.create({
      data: {
        content: msg.content,
        userId: msg.userId,
        channelId: channel.id,
        deliveryStatus: 'SENT',
      },
    });

    // Store in vector database
    await vectorStore.storeMessage(
      createdMessage.id,
      createdMessage.content,
      {
        channelId: channel.id,
        userId: msg.userId,
        timestamp: createdMessage.createdAt.toISOString()
      }
    );
  }

  console.log('Test data inserted and vectorized successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 