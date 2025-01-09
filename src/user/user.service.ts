import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ChannelType } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: { id: string; email: string; username: string; imageUrl?: string }) {
    return this.prisma.user.upsert({
      where: {
        id: data.id
      },
      create: {
        id: data.id,
        email: data.email,
        name: data.username,
        imageUrl: data.imageUrl,
      },
      update: {
        email: data.email,
        name: data.username,
        imageUrl: data.imageUrl,
      }
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async getUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateUser(id: string, data: { name?: string; imageUrl?: string }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        imageUrl: data.imageUrl,
      },
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async updateUserOnlineStatus(id: string, isOnline: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: {
        isOnline,
      },
    });
  }

  async searchUsers(currentUserId: string, options: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 10 } = options;
    
    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get all users that current user has DMs with
    const existingDMUserIds = await this.prisma.channelMember.findMany({
      where: {
        userId: currentUserId,
        channel: {
          type: ChannelType.DM,
          members: {
            some: {
              userId: { not: currentUserId }
            }
          }
        }
      },
      select: {
        channel: {
          select: {
            members: {
              where: {
                userId: { not: currentUserId }
              },
              select: {
                userId: true
              }
            }
          }
        }
      }
    }).then(members => 
      members.map(m => m.channel.members[0]?.userId).filter(Boolean)
    );

    // Build where clause
    const where: Prisma.UserWhereInput = {
      id: { 
        not: currentUserId,
        notIn: existingDMUserIds // Exclude users who already have DMs with current user
      },
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { email: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      } : {}),
    };

    // Get total count for pagination
    const total = await this.prisma.user.count({ where });

    // Get users
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        isOnline: true,
      },
      skip,
      take: limit,
      orderBy: [
        { isOnline: 'desc' },
        { name: 'asc' },
      ],
    });

    // Calculate pagination info
    const hasMore = total > skip + users.length;

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        hasMore,
      },
    };
  }
} 