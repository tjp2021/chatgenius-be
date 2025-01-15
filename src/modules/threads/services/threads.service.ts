import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { ThreadResponseDto, ThreadReplyDto } from '../dto/thread-response.dto';

@Injectable()
export class ThreadsService {
  constructor(private readonly prisma: PrismaService) {}

  async createThread(userId: string, messageId: string): Promise<ThreadResponseDto> {
    // First verify the message exists and user has access to it
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          include: {
            members: {
              where: { userId }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (!message.channel.members.length) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    // Return thread details
    return {
      id: message.id,
      channelId: message.channelId,
      parentMessage: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        user: message.user
      },
      replies: [] as ThreadReplyDto[],
      replyCount: 0,
      lastReplyAt: null,
      participantCount: 1
    };
  }

  async getThread(threadId: string): Promise<ThreadResponseDto> {
    const thread = await this.prisma.message.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return {
      id: thread.id,
      channelId: thread.channelId,
      parentMessage: {
        id: thread.id,
        content: thread.content,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        user: thread.user
      },
      replies: thread.replies.map(reply => ({
        id: reply.id,
        content: reply.content,
        threadId: reply.replyToId,
        userId: reply.userId,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        user: reply.user
      })),
      replyCount: thread.replies.length,
      lastReplyAt: thread.replies.length > 0 
        ? thread.replies[thread.replies.length - 1].createdAt 
        : null,
      participantCount: new Set([
        thread.userId,
        ...thread.replies.map(reply => reply.userId)
      ]).size
    };
  }

  async addReply(threadId: string, userId: string, content: string) {
    // First verify the thread exists and user has access
    const thread = await this.prisma.message.findUnique({
      where: { id: threadId },
      include: {
        channel: {
          include: {
            members: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (!thread.channel.members.length) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    // Create the reply
    const reply = await this.prisma.message.create({
      data: {
        content,
        channelId: thread.channelId,
        userId,
        replyToId: threadId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        }
      }
    });

    // Return updated thread
    return this.getThread(threadId);
  }

  async getReplies(
    threadId: string,
    userId: string,
    cursor?: string,
    limit: number = 50
  ): Promise<ThreadReplyDto[]> {
    // First verify thread exists and user has access
    const thread = await this.prisma.message.findUnique({
      where: { id: threadId },
      include: {
        channel: {
          include: {
            members: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (!thread.channel.members.length) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    // Get replies with pagination
    const replies = await this.prisma.message.findMany({
      where: {
        replyToId: threadId
      },
      take: limit,
      ...(cursor && {
        cursor: {
          id: cursor
        },
        skip: 1 // Skip the cursor
      }),
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        }
      }
    });

    // Map to DTO format
    return replies.map(reply => ({
      id: reply.id,
      content: reply.content,
      threadId: reply.replyToId,
      userId: reply.userId,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      user: reply.user
    }));
  }
} 