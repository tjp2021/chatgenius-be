import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChannelsService } from '../channels/channels.service';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  async create(userId: string, dto: CreateMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        channelId: dto.channelId,
        userId,
        parentId: dto.parentId,
      },
      include: {
        user: true,
      },
    });

    // Update channel activity
    await this.channelsService.updateLastActivity(dto.channelId);

    return message;
  }

  async findAll(channelId: string, cursor?: string) {
    return this.prisma.message.findMany({
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        channelId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
      },
    });
  }

  async findReplies(messageId: string) {
    return this.prisma.message.findMany({
      where: {
        parentId: messageId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: true,
      },
    });
  }
} 