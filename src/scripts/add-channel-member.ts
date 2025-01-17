import { PrismaClient, MemberRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const member = await prisma.channelMember.create({
      data: {
        userId: 'user_001',
        channelId: 'channel_002',
        role: MemberRole.MEMBER
      },
      include: { channel: true }
    });
    console.log('Added channel member:', JSON.stringify(member, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 