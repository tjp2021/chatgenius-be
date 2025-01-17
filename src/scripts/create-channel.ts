import { PrismaClient, ChannelType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const channel = await prisma.channel.create({
      data: {
        id: 'channel_002',
        name: 'Test Channel',
        type: ChannelType.PUBLIC,
        createdById: 'user_001'
      }
    });
    console.log('Created channel:', JSON.stringify(channel, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 