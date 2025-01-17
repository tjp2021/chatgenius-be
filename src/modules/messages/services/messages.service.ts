import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma.service';
import { VectorStoreService } from '../../../lib/vector-store.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { MessageDeliveryStatus, Message } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { SearchOptions, SearchResult, MessageSearchResult, MessageCursor } from '../interfaces/search.interface';

interface VectorSearchResult {
  id: string;
  score: number;
}

interface MessageWithScore extends Message {
  score: number;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorStoreService: VectorStoreService
  ) {}

  private mapMessageWithScore(message: Message, vectorResult?: VectorSearchResult): MessageWithScore {
    return {
      ...message,
      score: vectorResult?.score ?? 0
    };
  }

  async getMessages(channelId: string, userId: string, limit = 50, cursor?: string) {
    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    // Get messages with cursor-based pagination
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
      },
      take: limit,
      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1, // Skip the cursor
      }),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
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
            replies: true,
          },
        },
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      messages: messages.map(message => ({
        ...message,
        hasReplies: message._count.replies > 0,
      })),
      nextCursor,
    };
  }

  async getMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
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
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: message.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this message');
    }

    return message;
  }

  async createMessage(userId: string, createMessageDto: CreateMessageDto) {
    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: createMessageDto.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    // Generate a temporary ID for vector storage
    const messageId = uuidv4();

    // Store message in vector store
    await this.vectorStoreService.storeMessage(
      messageId,
      createMessageDto.content,
      {
        channelId: createMessageDto.channelId,
        userId,
        timestamp: new Date().toISOString(),
      }
    );

    // Create message with vector ID
    const message = await this.prisma.message.create({
      data: {
        content: createMessageDto.content,
        channelId: createMessageDto.channelId,
        userId,
        replyToId: createMessageDto.replyToId || null,
        deliveryStatus: MessageDeliveryStatus.SENT
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        replyTo: {
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
      },
    });

    return message;
  }

  async updateMessage(messageId: string, userId: string, updateMessageDto: UpdateMessageDto) {
    // Verify message exists and belongs to user
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: updateMessageDto,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    // Verify message exists and belongs to user
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });
  }

  async updateMessageDeliveryStatus(messageId: string, status: MessageDeliveryStatus) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deliveryStatus: status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  /**
   * Get the number of replies in a thread
   * @param threadId The ID of the message that started the thread
   * @returns The number of replies in the thread
   */
  async getThreadReplyCount(threadId: string): Promise<number> {
    const count = await this.prisma.message.count({
      where: {
        replyToId: threadId,
      },
    });

    return count;
  }

  /**
   * Get all messages in a thread with pagination
   * @param threadId The ID of the message that started the thread
   * @param userId The ID of the user requesting the messages
   * @param limit Maximum number of messages to return
   * @param cursor Cursor for pagination
   */
  async getThreadMessages(threadId: string, userId: string, limit = 50, cursor?: string) {
    // First get the thread starter message to verify channel access
    const threadStarter = await this.prisma.message.findUnique({
      where: { id: threadId },
      select: { channelId: true },
    });

    if (!threadStarter) {
      throw new NotFoundException('Thread not found');
    }

    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: threadStarter.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this thread');
    }

    // Get thread messages with cursor-based pagination
    const messages = await this.prisma.message.findMany({
      where: {
        replyToId: threadId,
      },
      take: limit,
      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1, // Skip the cursor
      }),
      orderBy: {
        createdAt: 'asc', // Thread messages in chronological order
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
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
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      messages,
      nextCursor,
    };
  }

  /**
   * Get thread details including the starter message
   * @param threadId The ID of the message that started the thread
   * @param userId The ID of the user requesting the details
   */
  async getThreadDetails(threadId: string, userId: string) {
    const threadStarter = await this.prisma.message.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        reactions: {
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
            replies: true, // Count of replies in thread
          },
        },
      },
    });

    if (!threadStarter) {
      throw new NotFoundException('Thread not found');
    }

    // Verify user has access to channel
    const member = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: threadStarter.channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this thread');
    }

    // Get the latest reply
    const latestReply = await this.prisma.message.findFirst({
      where: {
        replyToId: threadId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return {
      threadStarter,
      replyCount: threadStarter._count.replies,
      latestReply,
    };
  }

  /**
   * Search messages across user's accessible channels using semantic search
   * @param userId The ID of the user performing the search
   * @param query The search query
   * @param options Search options including limit, cursor, minScore, and search type
   */
  async searchMessages(
    userId: string, 
    query: string,
    options: SearchOptions = { userId }
  ): Promise<SearchResult<MessageSearchResult>> {
    const { 
      limit = 20,
      cursor,
      minScore = 0.5,
      searchType = 'semantic',
      channelId,
      threadId,
      fromUserId
    } = options;

    console.log('🔍 [MessagesService] Starting search with:', {
      userId,
      query,
      channelId,
      searchType,
      threadId,
      fromUserId,
      limit,
      cursor,
      minScore
    });

    // Get all channels the user has access to
    const memberships = await this.prisma.channelMember.findMany({
      where: { userId },
      select: { channelId: true }
    });

    console.log('🔍 [MessagesService] Channel memberships:', {
      userId,
      memberships: JSON.stringify(memberships),
      accessibleChannels: memberships.map(m => m.channelId)
    });

    // If thread search, find all messages in the thread
    if (searchType === 'thread') {
      console.log('🔍 [MessagesService] Performing thread search for:', {
        threadId,
        channelId,
        accessibleChannels: memberships.map(m => m.channelId)
      });
      
      // First verify the thread root message exists and user has access
      const rootMessage = await this.prisma.message.findFirst({
        where: { 
          id: threadId,
          channelId: { in: channelId ? [channelId] : memberships.map(m => m.channelId) }
        }
      });

      console.log('🔍 [MessagesService] Thread root message:', {
        found: !!rootMessage,
        messageId: rootMessage?.id,
        channelId: rootMessage?.channelId
      });

      if (!rootMessage) {
        console.log('⚠️ [MessagesService] Thread root message not found or no access:', threadId);
        return { items: [], pageInfo: { hasNextPage: false }, total: 0 };
      }

      // Get all messages in the thread
      const threadMessages = await this.prisma.message.findMany({
        where: {
          OR: [
            { id: threadId },
            { replyToId: threadId }
          ],
          channelId: rootMessage.channelId
        },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          replyTo: {
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
        }
      });

      console.log('🔍 [MessagesService] Found thread messages:', {
        count: threadMessages.length,
        threadId,
        channelId: rootMessage.channelId,
        messageIds: threadMessages.map(m => m.id)
      });

      return {
        items: threadMessages.map(msg => ({
          ...msg,
          score: 1,
          user: msg.user,
          replyTo: msg.replyTo ?? undefined
        })),
        pageInfo: { hasNextPage: false },
        total: threadMessages.length
      };
    }

    const channelIds = channelId ? [channelId] : memberships.map(m => m.channelId);
    
    console.log('🔍 [MessagesService] Will search in channels:', {
      channelIds,
      searchType,
      query
    });

    if (channelIds.length === 0) {
      console.log('⚠️ [MessagesService] User has no channel access:', userId);
      return { items: [], pageInfo: { hasNextPage: false }, total: 0 };
    }

    if (searchType === 'text') {
      console.log('🔍 [MessagesService] Performing text search:', {
        query,
        channels: channelIds.join(', '),
        fromUserId
      });

      // First verify all messages in the channels
      const allMessages = await this.prisma.message.findMany({
        where: { channelId: { in: channelIds } },
        select: { id: true, content: true, channelId: true }
      });
      
      console.log('🔍 [MessagesService] Found messages:', {
        total: allMessages.length,
        sample: allMessages.slice(0, 2)
      });

      const where = {
        channelId: { in: channelIds },
        content: {
          contains: query,
          mode: 'insensitive' as const
        }
      };

      if (fromUserId) {
        where['userId'] = fromUserId;
      }

      console.log('🔍 [MessagesService] Text search where clause:', JSON.stringify(where));

      const messages = await this.prisma.message.findMany({
        where,
        take: limit,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1
        }),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          replyTo: {
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
        }
      });

      const total = await this.prisma.message.count({ where });
      
      console.log('🔍 [MessagesService] Search results:', {
        matches: messages.length,
        total,
        firstMatch: messages[0] ? JSON.stringify(messages[0]) : 'none'
      });

      return {
        items: messages.map(msg => ({
          ...msg,
          score: 1, // Text matches get full score
          user: msg.user,
          replyTo: msg.replyTo ?? undefined
        })),
        pageInfo: {
          hasNextPage: messages.length === limit,
          endCursor: messages.length === limit ? messages[messages.length - 1].id : undefined
        },
        total
      };
    }

    // Decode cursor if provided
    let cursorData: MessageCursor | undefined;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        cursorData = JSON.parse(decoded);
      } catch (e) {
        // Invalid cursor, ignore it
      }
    }

    // Search for similar messages in accessible channels
    console.log('🔍 [MessagesService] Calling vectorStoreService.findSimilarMessages with:', {
      query,
      channelIds,
      cursorData: cursorData ? {
        id: cursorData.id,
        score: cursorData.score,
        timestamp: cursorData.timestamp
      } : undefined
    });

    const vectorResults = await this.vectorStoreService.findSimilarMessages(query, {
      channelIds,
      ...(cursorData && {
        after: {
          id: cursorData.id,
          score: cursorData.score,
          timestamp: cursorData.timestamp
        }
      })
    });

    console.log('🔍 [MessagesService] Vector search results:', {
      resultsCount: vectorResults?.length,
      firstResult: vectorResults?.[0] ? {
        id: vectorResults[0].id,
        score: vectorResults[0].score,
        metadata: vectorResults[0].metadata
      } : null
    });

    // Filter by minimum score
    const filteredResults = vectorResults.filter(r => r.score >= minScore);

    // If no results found, return empty array
    if (!filteredResults.length) {
      return {
        items: [],
        pageInfo: { hasNextPage: false },
        total: 0
      };
    }

    // If using cursor, start from the cursor position
    let startIndex = 0;
    if (cursor && cursorData) {
      const cursorIndex = filteredResults.findIndex(r => r.id === cursorData.id);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    // Get the current page of results
    const availablePageResults = filteredResults.slice(startIndex, startIndex + limit);

    // Get full message details for the results
    const messages = await this.prisma.message.findMany({
      where: {
        id: { in: availablePageResults.map(r => r.id) }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        replyTo: {
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
      }
    });

    console.log('🔍 [MessagesService] Messages found in database:', {
      count: messages.length,
      ids: messages.map(m => m.id),
      vectorIds: availablePageResults.map(r => r.id)
    });

    // If no messages found, return empty result
    if (messages.length === 0) {
      return {
        items: [],
        pageInfo: { hasNextPage: false },
        total: 0
      };
    }

    // Combine message details with search scores
    const items: MessageSearchResult[] = messages.map(message => {
      const vectorResult = availablePageResults.find(r => r.id === message.id);
      return {
        ...message,
        score: vectorResult?.score ?? 0,
        user: message.user,
        replyTo: message.replyTo ?? undefined
      };
    });

    // Check if there are more results after this page
    const hasNextPage = filteredResults.length > (startIndex + items.length);

    // Generate cursor for last item if there are more results
    let endCursor: string | undefined;
    if (items.length > 0 && hasNextPage) {
      const lastItem = items[items.length - 1];
      const lastVector = availablePageResults.find(r => r.id === lastItem.id)!;
      
      const cursorData: MessageCursor = {
        id: lastItem.id,
        score: lastVector.score,
        timestamp: lastItem.createdAt.toISOString()
      };
      
      endCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return {
      items,
      pageInfo: {
        hasNextPage,
        endCursor
      },
      total: filteredResults.length
    };
  }
} 