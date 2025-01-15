const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const fetchData = async () => {
  try {
    const messages = await prisma.message.findMany({
      select: {
        userId: true,
        content: true,
        createdAt: true,
      },
    });

    const structuredData = messages.map(item => ({
      userId: item.userId,
      content: item.content,
      timestamp: item.createdAt.toISOString(),
    }));

    console.log('Structured Data:', structuredData);
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    await prisma.$disconnect();
  }
};

fetchData(); 