import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const memberships = await prisma.channelMember.findMany({
      where: { userId: 'user_001' },
      include: { channel: true }
    });
    console.log('Channel memberships:', JSON.stringify(memberships, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 