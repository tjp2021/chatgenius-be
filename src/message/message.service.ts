import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocketGateway } from '../gateways/socket.gateway';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private socketGateway: SocketGateway
  ) {}

  async getChannelMessages(channelId: string, userId: string) {
    // Verify channel access
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a channel member');
    }

    return this.prisma.message.findMany({
      where: {
        channelId,
        parentId: null, // Only get top-level messages
      },
      include: {
        user: true,
        replies: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createMessage(channelId: string, userId: string, data: { content: string; parentId?: string }) {
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a channel member');
    }

    const message = await this.prisma.message.create({
      data: {
        content: data.content,
        channelId,
        userId,
        parentId: data.parentId,
      },
      include: {
        user: true,
      },
    });

    // Emit new message to channel
    this.socketGateway.server.to(`channel:${channelId}`).emit('message:new', message);

    return message;
  }
} 