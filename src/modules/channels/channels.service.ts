import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import type { Channel } from '.prisma/client';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateChannelDto): Promise<Channel> {
    return this.prisma.channel.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        createdById: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });
  }

  async findAll(userId: string): Promise<Channel[]> {
    return this.prisma.channel.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  async findOne(id: string): Promise<Channel | null> {
    return this.prisma.channel.findUnique({
      where: { id },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.channel.delete({
      where: {
        id,
        createdById: userId,
      },
    });
  }
}