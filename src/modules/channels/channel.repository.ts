import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Channel } from '../../core/events/event.types';
import { 
  ChannelRepository, 
  CreateChannelDto, 
  UpdateChannelDto, 
  ChannelQuery,
  ChannelMember,
  MemberRole,
  ChannelType
} from './channel.types';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class PrismaChannelRepository implements ChannelRepository {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache
  ) {}

  private getChannelCacheKey(id: string) {
    return `channel:${id}`;
  }

  private getMemberCacheKey(channelId: string, userId: string) {
    return `channel:${channelId}:member:${userId}`;
  }

  async create(userId: string, data: CreateChannelDto): Promise<Channel> {
    const channel = await this.prisma.channel.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        createdById: userId,
        members: {
          create: {
            userId,
            role: MemberRole.OWNER,
          }
        }
      },
      include: {
        members: true,
        createdBy: true,
      },
    });

    await this.cache.set(this.getChannelCacheKey(channel.id), channel, 300);
    return channel;
  }

  async update(channelId: string, data: UpdateChannelDto): Promise<Channel> {
    const channel = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
      },
      include: {
        members: true,
        createdBy: true,
      },
    });

    await this.cache.set(this.getChannelCacheKey(channel.id), channel, 300);
    return channel;
  }

  async delete(channelId: string): Promise<void> {
    await this.prisma.channel.delete({
      where: { id: channelId },
    });

    await this.cache.del(this.getChannelCacheKey(channelId));
  }

  async findById(channelId: string): Promise<Channel | null> {
    const cached = await this.cache.get<Channel>(this.getChannelCacheKey(channelId));
    if (cached) return cached;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: true,
        createdBy: true,
      },
    });

    if (channel) {
      await this.cache.set(this.getChannelCacheKey(channelId), channel, 300);
    }

    return channel;
  }

  async findAll(userId: string, query: ChannelQuery): Promise<Channel[]> {
    const { type, search } = query;

    const where: any = {};
    
    // Filter by type if specified
    if (type) {
      where.type = type;
    }

    // Add search condition if specified
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // For non-public channels, user must be a member
    if (type !== ChannelType.PUBLIC) {
      where.members = {
        some: {
          userId,
        },
      };
    }

    return this.prisma.channel.findMany({
      where,
      include: {
        members: true,
        createdBy: true,
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
    });
  }

  async findMember(channelId: string, userId: string): Promise<ChannelMember | null> {
    const cached = await this.cache.get<ChannelMember>(this.getMemberCacheKey(channelId, userId));
    if (cached) return cached;

    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (member) {
      await this.cache.set(this.getMemberCacheKey(channelId, userId), member, 300);
    }

    return member;
  }

  async findMembers(channelId: string): Promise<ChannelMember[]> {
    return this.prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: true,
      },
    });
  }

  async addMember(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember> {
    const member = await this.prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role,
      },
    });

    await this.cache.set(this.getMemberCacheKey(channelId, userId), member, 300);
    await this.cache.del(this.getChannelCacheKey(channelId));

    return member;
  }

  async removeMember(channelId: string, userId: string): Promise<void> {
    await this.prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    await this.cache.del(this.getMemberCacheKey(channelId, userId));
    await this.cache.del(this.getChannelCacheKey(channelId));
  }
} 