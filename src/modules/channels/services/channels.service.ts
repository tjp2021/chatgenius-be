import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelQuery } from '../types/channel.types';
import { ChannelType, MemberRole } from '@prisma/client';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async getChannels(userId: string, query: ChannelQuery) {
    if (!query.view) {
      throw new BadRequestException('view parameter is required');
    }

    switch (query.view) {
      case 'sidebar':
        return this.getSidebarChannels(userId);
      case 'browse':
        return this.getBrowseChannels(userId);
      case 'leave':
        return this.getLeaveChannels(userId);
      default:
        throw new BadRequestException(`Invalid view type: ${query.view}`);
    }
  }

  private async getSidebarChannels(userId: string) {
    // Get public channels where user is a member
    return this.prisma.channel.findMany({
      where: {
        AND: [
          { type: ChannelType.PUBLIC },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
    });
  }

  private async getBrowseChannels(userId: string) {
    // Get all public channels and mark membership
    const channels = await this.prisma.channel.findMany({
      where: {
        type: ChannelType.PUBLIC,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
    });

    // Add isJoined flag for each channel
    return channels.map(channel => ({
      ...channel,
      isJoined: channel.members.some(member => member.userId === userId)
    }));
  }

  private async getLeaveChannels(userId: string) {
    // Get all channels (public, private, DM) where user is a member
    return this.prisma.channel.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
    });
  }

  async getChannel(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: {
        id: channelId,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Check if user is a member
    const isJoined = channel.members.some(member => member.userId === userId);

    // For private/DM channels, only allow access if user is a member
    if (channel.type !== 'PUBLIC' && !isJoined) {
      throw new NotFoundException('Channel not found');
    }

    return {
      ...channel,
      isJoined
    };
  }

  async createChannel(userId: string, createChannelDto: CreateChannelDto) {
    // First verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Special handling for DM channels
    if (createChannelDto.type === ChannelType.DM) {
      if (!createChannelDto.targetUserId) {
        throw new BadRequestException('targetUserId is required for DM channels');
      }

      // Prevent creating DM with yourself
      if (userId === createChannelDto.targetUserId) {
        throw new BadRequestException('Cannot create a DM channel with yourself');
      }

      // Check if target user exists
      const targetUser = await this.prisma.user.findUnique({
        where: { id: createChannelDto.targetUserId },
      });

      if (!targetUser) {
        throw new NotFoundException(`Target user with ID ${createChannelDto.targetUserId} not found`);
      }

      // Check if DM channel already exists between these users
      const existingDM = await this.prisma.channel.findFirst({
        where: {
          type: ChannelType.DM,
          AND: [
            {
              members: {
                some: {
                  userId,
                },
              },
            },
            {
              members: {
                some: {
                  userId: createChannelDto.targetUserId,
                },
              },
            },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      if (existingDM) {
        console.log('Found existing DM channel:', existingDM);
        return existingDM;
      }

      // Create new DM channel
      const dmName = `${user.name}, ${targetUser.name}`;
      try {
        return await this.prisma.channel.create({
          data: {
            name: dmName,
            type: ChannelType.DM,
            createdById: userId,
            members: {
              create: [
                {
                  userId,
                  role: MemberRole.OWNER,
                },
                {
                  userId: createChannelDto.targetUserId,
                  role: MemberRole.MEMBER,
                },
              ],
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        });
      } catch (error) {
        throw new Error(`Failed to create DM channel: ${error.message}`);
      }
    }

    // Regular channel creation logic
    if (createChannelDto.memberIds?.length) {
      const members = await this.prisma.user.findMany({
        where: {
          id: {
            in: createChannelDto.memberIds,
          },
        },
      });

      if (members.length !== createChannelDto.memberIds.length) {
        throw new NotFoundException('One or more specified members do not exist');
      }
    }

    try {
      return await this.prisma.channel.create({
        data: {
          name: createChannelDto.name,
          description: createChannelDto.description,
          type: createChannelDto.type,
          createdById: userId,
          members: {
            create: [
              {
                userId,
                role: MemberRole.OWNER,
              },
              ...(createChannelDto.memberIds?.map(memberId => ({
                userId: memberId,
                role: MemberRole.MEMBER,
              })) || []),
            ],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to create channel: ${error.message}`);
    }
  }

  async updateChannel(userId: string, channelId: string, updateChannelDto: UpdateChannelDto) {
    // Verify user has permission to update channel
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        members: {
          some: {
            userId,
            role: {
              in: ['OWNER', 'ADMIN'],
            },
          },
        },
      },
    });

    if (!channel) {
      throw new Error('Channel not found or insufficient permissions');
    }

    return this.prisma.channel.update({
      where: { id: channelId },
      data: updateChannelDto,
      include: {
        members: true,
      },
    });
  }

  async removeMember(userId: string, channelId: string) {
    console.log(`Attempting to remove member. userId: ${userId}, channelId: ${channelId}`);

    try {
      // First check if the channel exists
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          members: true
        }
      });

      console.log('Found channel:', channel);

      if (!channel) {
        console.log(`Channel not found with ID ${channelId}`);
        throw new NotFoundException(`Channel with ID ${channelId} not found`);
      }

      // Then check if user is a member
      const membership = channel.members.find(member => member.userId === userId);
      console.log('Found membership:', membership);

      if (!membership) {
        console.log(`User ${userId} is not a member of channel ${channelId}`);
        throw new BadRequestException('User is not a member of this channel');
      }

      // For regular channels, owners can't leave if there are other members
      if (
        channel.type !== ChannelType.DM &&
        membership.role === MemberRole.OWNER && 
        channel.members.length > 1
      ) {
        console.log('Owner cannot leave channel with other members');
        throw new BadRequestException('Channel owner cannot leave while other members exist');
      }

      console.log('Attempting to delete channel member');
      // Remove the member
      await this.prisma.channelMember.delete({
        where: {
          channelId_userId: {
            channelId,
            userId,
          },
        },
      });

      // If this was the last member or it's a DM, delete the channel
      if (channel.members.length === 1 || channel.type === ChannelType.DM) {
        console.log('Last member or DM channel - deleting channel');
        await this.deleteChannel(userId, channelId);
        return {
          success: true,
          wasDeleted: true,
          message: 'Successfully left and deleted channel'
        };
      }

      return {
        success: true,
        wasDeleted: false,
        message: 'Successfully left channel'
      };

    } catch (error) {
      console.error('Error removing member:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new Error(`Failed to leave channel: ${error.message}`);
    }
  }

  async deleteChannel(userId: string, channelId: string) {
    // First get the channel to check its type
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId },
      include: {
        members: true
      }
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // For regular channels, verify owner permissions
    if (channel.type !== ChannelType.DM) {
      const hasPermission = channel.members.some(
        member => member.userId === userId && member.role === MemberRole.OWNER
      );

      if (!hasPermission) {
        throw new Error('Insufficient permissions to delete channel');
      }
    }

    try {
      // Delete all messages first
      await this.prisma.message.deleteMany({
        where: { channelId },
      });

      // Delete all channel members
      await this.prisma.channelMember.deleteMany({
        where: { channelId },
      });

      // Finally delete the channel
      await this.prisma.channel.delete({
        where: { id: channelId },
      });
    } catch (error) {
      throw new Error(`Failed to delete channel: ${error.message}`);
    }
  }

  async addMember(channelId: string, userId: string, role: MemberRole) {
    // Check if channel exists
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true }
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Check if user is already a member
    const existingMember = channel.members.find(member => member.userId === userId);
    if (existingMember) {
      throw new BadRequestException('User is already a member of this channel');
    }

    // Add member to channel
    const updatedChannel = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        members: {
          create: {
            userId,
            role
          }
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      }
    });

    return updatedChannel;
  }
} 