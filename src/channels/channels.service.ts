import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async createChannel(userId: string, data: { name: string; type: 'PUBLIC' | 'PRIVATE' | 'DM' }) {
    return this.prisma.channel.create({
      data: {
        name: data.name,
        type: data.type,
        createdById: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  async listChannels(userId: string) {
    return this.prisma.channel.findMany({
      where: {
        OR: [
          { type: 'PUBLIC' },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        members: true,
      },
    });
  }
} 