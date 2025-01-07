import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ChannelType, MemberRole } from '@prisma/client';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateChannelDto) {
    const channel = await this.prisma.channel.create({
      data: {
        ...dto,
        createdById: userId,
        members: {
          create: {
            userId,
            role: MemberRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return channel;
  }

  async findAll(userId: string) {
    return this.prisma.channel.findMany({
      where: {
        OR: [
          { type: ChannelType.PUBLIC },
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
        members: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
  }

  async findOne(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        messages: {
          take: 50,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: true,
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.type !== ChannelType.PUBLIC) {
      const isMember = channel.members.some(member => member.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('Not a member of this channel');
      }
    }

    return channel;
  }

  async join(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: true,
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.type !== ChannelType.PUBLIC) {
      throw new ForbiddenException('Cannot join private or DM channels directly');
    }

    const isMember = channel.members.some(member => member.userId === userId);
    if (isMember) {
      throw new ForbiddenException('Already a member of this channel');
    }

    return this.prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role: MemberRole.MEMBER,
      },
      include: {
        channel: true,
        user: true,
      },
    });
  }

  async leave(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: true,
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = channel.members.find(m => m.userId === userId);
    if (!member) {
      throw new ForbiddenException('Not a member of this channel');
    }

    if (member.role === MemberRole.OWNER) {
      throw new ForbiddenException('Channel owner cannot leave the channel');
    }

    return this.prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });
  }
} 