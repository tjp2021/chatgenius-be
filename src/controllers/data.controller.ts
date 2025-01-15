import { Controller, Get, Param } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('data')
export class DataController {
  @Get('fetch')
  async fetchData() {
    try {
      const messages = await prisma.message.findMany({
        select: {
          userId: true,
          content: true,
          createdAt: true,
          channelId: true,
        },
      });

      const structuredData = messages.map(item => ({
        userId: item.userId,
        content: item.content,
        channelId: item.channelId,
        timestamp: item.createdAt.toISOString(),
      }));

      return structuredData;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  @Get('user/:userId')
  async fetchUserData(@Param('userId') userId: string) {
    try {
      // Step 1: Fetch User
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Step 2: Find Channels
      const channels = await prisma.channel.findMany({
        where: {
          members: {
            some: {
              userId: userId
            }
          }
        },
      });

      const channelIds = channels.map(channel => channel.id);

      // Step 3: Fetch Messages
      const messages = await prisma.message.findMany({
        where: {
          userId: userId,
          channelId: { in: channelIds },
        },
      });

      const messageIds = messages.map(message => message.id);

      // Step 4: Fetch Threaded Messages
      const threadedMessages = await prisma.message.findMany({
        where: {
          replyToId: { in: messageIds },
        },
      });

      // Structure the data
      const structuredData = {
        user,
        channels,
        messages,
        threadedMessages,
      };

      return structuredData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
} 