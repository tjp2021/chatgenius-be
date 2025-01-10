import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ChannelRepository, CreateChannelDto, UpdateChannelDto, ChannelQuery } from './channel.types';
import { Channel, ChannelMember } from '../../core/events/event.types';
import { ChannelType, MemberRole } from '@prisma/client';

@Injectable()
export class PrismaChannelRepository implements ChannelRepository {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string, 
    data: Omit<CreateChannelDto, 'memberIds'>,
    memberIds?: string[]
  ): Promise<Channel> {
    const timestamp = new Date().toISOString();
    
    console.log('=============== CHANNEL CREATE START ===============');
    console.log('STEP 1: Received Data:', {
      userId,
      data,
      memberIds,
      timestamp
    });

    // First, create the members array with proper typing
    const members: Array<{ userId: string; role: MemberRole }> = [{
      userId,
      role: 'OWNER',
    }];

    if (memberIds?.length) {
      const additionalMembers = memberIds
        .filter(id => id && id !== userId)
        .map(id => ({
          userId: id,
          role: 'MEMBER' as MemberRole
        }));
      members.push(...additionalMembers);
    }

    console.log('STEP 2: Processed Members:', {
      members,
      timestamp
    });

    // Create the exact data structure for Prisma
    const createData = {
      name: data.name,
      description: data.description || "",
      type: data.type as ChannelType,
      createdById: userId,
      memberCount: members.length,
      members: {
        createMany: {
          data: members
        }
      }
    };

    console.log('STEP 3: Final Prisma Data:', {
      createData: JSON.stringify(createData, null, 2),
      timestamp
    });

    try {
      console.log('STEP 4: Calling Prisma');
      const result = await this.prisma.channel.create({
        data: createData,
        include: {
          members: {
            include: {
              user: true,
            },
          },
          createdBy: true,
        },
      });

      console.log('STEP 5: Prisma Result:', {
        result: JSON.stringify(result, null, 2),
        timestamp
      });
      console.log('=============== CHANNEL CREATE END ===============');

      return result;
    } catch (error) {
      console.error('STEP X: Error in create:', {
        error: error.message,
        stack: error.stack,
        data: JSON.stringify(createData, null, 2),
        timestamp
      });
      console.log('=============== CHANNEL CREATE ERROR ===============');
      throw error;
    }
  }

  async update(channelId: string, data: UpdateChannelDto): Promise<Channel> {
    return this.prisma.channel.update({
      where: { id: channelId },
      data,
      include: {
        members: {
          include: {
            user: true
          }
        },
        createdBy: true,
      },
    });
  }

  async delete(channelId: string): Promise<void> {
    await this.prisma.channel.delete({
      where: { id: channelId },
    });
  }

  async findById(channelId: string): Promise<Channel | null> {
    return this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: true
          }
        },
        createdBy: true,
      },
    });
  }

  async findAll(userId: string, query: ChannelQuery): Promise<Channel[]> {
    const { type, search, cursor, limit = 20 } = query;

    console.log('🔍 Finding channels for user:', { 
      userId,
      query,
      timestamp: new Date().toISOString()
    });

    return this.prisma.channel.findMany({
      where: {
        OR: [
          {
            type: "PUBLIC",
            members: {
              none: {
                userId: userId
              }
            }
          },
          {
            members: {
              some: {
                userId: userId
              }
            }
          }
        ],
        ...(search && {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        }),
        ...(type && { type })
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: {
          id: cursor
        }
      }),
      orderBy: {
        lastActivityAt: "desc"
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        createdBy: true
      }
    });
  }

  async findMember(channelId: string, userId: string): Promise<ChannelMember | null> {
    return this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });
  }

  async findMembers(channelId: string): Promise<ChannelMember[]> {
    return this.prisma.channelMember.findMany({
      where: {
        channelId,
      },
      include: {
        user: true,
      },
    });
  }

  async addMember(channelId: string, userId: string, role: MemberRole): Promise<ChannelMember> {
    return this.prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role,
      },
    });
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
  }
} 