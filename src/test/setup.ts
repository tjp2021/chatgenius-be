import { PrismaClient, ChannelType, MemberRole } from '@prisma/client';
import { VectorStoreService } from '../lib/vector-store.service';

const prisma = new PrismaClient();

async function clearTestData() {
  await prisma.reaction.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.channelMember.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Test data cleared');
}

async function createTestUser() {
  return await prisma.user.create({
    data: {
      id: 'test-user-123',
      name: 'Test User',
    },
  });
}

async function createTestChannel(userId: string) {
  const channel = await prisma.channel.create({
    data: {
      name: 'test-channel',
      type: ChannelType.PUBLIC,
      createdById: userId,
      members: {
        create: [
          {
            userId,
            role: MemberRole.OWNER,
          },
        ],
      },
    },
  });

  return channel;
}

async function createTestMessages(channelId: string, userId: string) {
  const messages = await prisma.message.createMany({
    data: [
      {
        content: 'This is a test message about basketball',
        channelId,
        userId,
      },
      {
        content: 'Another test message about coding',
        channelId,
        userId,
      },
      {
        content: 'A message about machine learning and AI',
        channelId,
        userId,
      },
    ],
  });

  return messages;
}

async function main() {
  try {
    await clearTestData();
    const user = await createTestUser();
    const channel = await createTestChannel(user.id);
    await createTestMessages(channel.id, user.id);
    console.log('Test data created successfully');
  } catch (error) {
    console.error('Error creating test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main(); 