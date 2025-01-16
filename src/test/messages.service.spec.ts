import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from '../modules/messages/services/messages.service';
import { PrismaService } from '../lib/prisma.service';
import { VectorStoreService } from '../lib/vector-store.service';
import { MessageDeliveryStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { SearchResult, MessageSearchResult } from '../modules/messages/interfaces/search.interface';
import { Message } from '@prisma/client';

describe('MessagesService', () => {
  let service: MessagesService;
  let prismaService: PrismaService;
  let vectorStoreService: VectorStoreService;

  const mockPrismaService = {
    message: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    channelMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockVectorStoreService = {
    storeMessage: jest.fn(),
    findSimilarMessages: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: VectorStoreService,
          useValue: mockVectorStoreService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prismaService = module.get<PrismaService>(PrismaService);
    vectorStoreService = module.get<VectorStoreService>(VectorStoreService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    it('should create a message with vector ID', async () => {
      // Mock data
      const userId = 'user-123';
      const channelId = 'channel-123';
      const content = 'Test message';
      const vectorId = 'vector-123';
      
      // Mock channel member check
      mockPrismaService.channelMember.findUnique.mockResolvedValue({ 
        userId, 
        channelId 
      });

      // Mock vector storage
      mockVectorStoreService.storeMessage.mockResolvedValue(vectorId);

      // Mock message creation
      const mockMessage = {
        id: 'msg-123',
        content,
        channelId,
        userId,
        vectorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.message.create.mockResolvedValue(mockMessage);

      // Test message creation
      const result = await service.createMessage(userId, { content, channelId });

      // Verify vector storage was called
      expect(mockVectorStoreService.storeMessage).toHaveBeenCalledWith(
        expect.any(String), // message ID
        content,
        expect.objectContaining({
          channelId,
          userId,
        })
      );

      // Verify message was created with vector ID
      expect(mockPrismaService.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content,
          channelId,
          userId,
          vectorId: expect.any(String),
          deliveryStatus: MessageDeliveryStatus.SENT,
        }),
        include: expect.any(Object),
      });

      // Verify result
      expect(result).toEqual(mockMessage);
    });
  });

  describe('searchMessages', () => {
    const userId = 'user-123';
    const channelId = 'channel-123';
    const query = 'test search';

    beforeEach(() => {
      // Mock channel membership
      mockPrismaService.channelMember.findMany.mockResolvedValue([
        { channelId, userId }
      ]);
    });

    it('should search messages in user accessible channels', async () => {
      // Mock vector search results
      const mockVectorResults = [
        {
          id: 'msg-1',
          score: 0.9,
          metadata: {
            channelId,
            userId: 'other-user',
            timestamp: '2024-01-15T00:00:00Z'
          }
        }
      ];
      mockVectorStoreService.findSimilarMessages.mockResolvedValue(mockVectorResults);

      // Mock message details
      const mockMessage = {
        id: 'msg-1',
        content: 'Test message',
        channelId,
        userId: 'other-user',
        createdAt: new Date('2024-01-15T00:00:00Z'),
        user: {
          id: 'other-user',
          name: 'Other User',
          imageUrl: 'avatar.jpg'
        }
      };
      mockPrismaService.message.findMany.mockResolvedValue([mockMessage]);

      const result = await service.searchMessages(userId, query);

      // Verify vector search was called with correct parameters
      expect(mockVectorStoreService.findSimilarMessages).toHaveBeenCalledWith(
        query,
        expect.objectContaining({
          channelIds: [channelId]
        })
      );

      // Verify message details were fetched
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['msg-1'] }
          },
          include: expect.any(Object)
        })
      );

      // Verify result format
      expect(result.items).toEqual([
        expect.objectContaining({
          ...mockMessage,
          score: 0.9
        })
      ]);
    });

    it('should return empty array if user has no channel access', async () => {
      // Mock no channel membership
      mockPrismaService.channelMember.findMany.mockResolvedValue([]);

      const result = await service.searchMessages(userId, query);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockVectorStoreService.findSimilarMessages).not.toHaveBeenCalled();
    });

    it('should handle no search results', async () => {
      mockVectorStoreService.findSimilarMessages.mockResolvedValue([]);

      const result = await service.searchMessages(userId, query);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockPrismaService.message.findMany).not.toHaveBeenCalled();
    });

    it('should handle deleted channels', async () => {
      // Mock vector results from a deleted channel
      const mockVectorResults = [{
        id: 'msg-1',
        score: 0.9,
        metadata: {
          channelId: 'deleted-channel',
          userId: 'other-user',
          timestamp: '2024-01-15T00:00:00Z'
        }
      }];
      mockVectorStoreService.findSimilarMessages.mockResolvedValue(mockVectorResults);

      // Mock that message no longer exists in database
      mockPrismaService.message.findMany.mockResolvedValue([]);

      const result = await service.searchMessages(userId, query);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle messages from channels user lost access to', async () => {
      // First search when user has access
      mockPrismaService.channelMember.findMany.mockResolvedValue([
        { channelId: 'channel-1', userId }
      ]);

      const mockVectorResults = [{
        id: 'msg-1',
        score: 0.9,
        metadata: {
          channelId: 'channel-1',
          userId: 'other-user',
          timestamp: '2024-01-15T00:00:00Z'
        }
      }];
      mockVectorStoreService.findSimilarMessages.mockResolvedValue(mockVectorResults);

      // Mock message exists but user lost access
      mockPrismaService.message.findMany.mockResolvedValue([{
        id: 'msg-1',
        content: 'Test message',
        channelId: 'channel-1',
        userId: 'other-user',
        createdAt: new Date('2024-01-15T00:00:00Z')
      }]);

      // Second search after user lost access
      mockPrismaService.channelMember.findMany.mockResolvedValue([]);
      
      const result = await service.searchMessages(userId, query);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockVectorStoreService.findSimilarMessages).not.toHaveBeenCalled();
    });

    it('should include thread context in search results', async () => {
      // Mock vector search results for a reply message
      const mockVectorResults = [{
        id: 'reply-1',
        score: 0.9,
        metadata: {
          channelId,
          userId: 'other-user',
          timestamp: '2024-01-15T00:00:00Z'
        }
      }];
      mockVectorStoreService.findSimilarMessages.mockResolvedValue(mockVectorResults);

      // Mock message details including thread parent
      const mockMessage = {
        id: 'reply-1',
        content: 'Test reply',
        channelId,
        userId: 'other-user',
        replyToId: 'parent-1',
        createdAt: new Date('2024-01-15T00:00:00Z'),
        user: {
          id: 'other-user',
          name: 'Other User',
          imageUrl: 'avatar.jpg'
        },
        replyTo: {
          id: 'parent-1',
          content: 'Parent message',
          channelId,
          userId: 'parent-user',
          createdAt: new Date('2024-01-14T00:00:00Z'),
          user: {
            id: 'parent-user',
            name: 'Parent User',
            imageUrl: 'avatar2.jpg'
          }
        }
      };
      mockPrismaService.message.findMany.mockResolvedValue([mockMessage]);

      const result = await service.searchMessages(userId, query);

      // Verify message details were fetched with thread context
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['reply-1'] }
          },
          include: expect.objectContaining({
            replyTo: expect.objectContaining({
              include: expect.objectContaining({
                user: expect.any(Object)
              })
            })
          })
        })
      );

      // Verify result includes thread context
      expect(result.items).toEqual([
        expect.objectContaining({
          ...mockMessage,
          score: 0.9,
          replyTo: expect.objectContaining({
            id: 'parent-1',
            content: 'Parent message'
          })
        })
      ]);
    });

    it('should return paginated results with cursor', async () => {
      const mockVectorResults = [
        { id: 'msg1', score: 0.9, metadata: { timestamp: '2024-01-01T00:00:00Z' } },
        { id: 'msg2', score: 0.8, metadata: { timestamp: '2024-01-02T00:00:00Z' } },
        { id: 'msg3', score: 0.7, metadata: { timestamp: '2024-01-03T00:00:00Z' } }
      ];
      
      mockVectorStoreService.findSimilarMessages.mockResolvedValue(mockVectorResults);
      mockPrismaService.channelMember.findMany.mockResolvedValue([{ channelId: 'channel1' }]);
      
      const mockMessages = mockVectorResults.map(r => ({
        id: r.id,
        content: `Message ${r.id}`,
        channelId: 'channel1',
        createdAt: new Date(r.metadata.timestamp),
        user: { id: 'user1', name: 'Test User', imageUrl: 'test.jpg' }
      }));
      
      // First page: return first 2 messages
      mockPrismaService.message.findMany.mockResolvedValueOnce(mockMessages.slice(0, 2));

      const result = await service.searchMessages('user1', 'test query', { 
        limit: 2 
      }) as SearchResult<MessageSearchResult>;

      // Verify pagination structure
      expect(result.items.length).toBe(2);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.endCursor).toBeDefined();
      expect(result.total).toBe(3);

      // Verify cursor encoding
      const cursor = Buffer.from(result.pageInfo.endCursor!, 'base64').toString('utf-8');
      const cursorData = JSON.parse(cursor);
      expect(cursorData).toEqual({
        id: 'msg2',
        score: 0.8,
        timestamp: '2024-01-02T00:00:00.000Z'
      });

      // Second page: return only the last message
      mockPrismaService.message.findMany.mockResolvedValueOnce([mockMessages[2]]);

      // Test next page
      const nextPage = await service.searchMessages('user1', 'test query', {
        cursor: result.pageInfo.endCursor,
        limit: 2
      }) as SearchResult<MessageSearchResult>;

      expect(nextPage.items.length).toBe(1);
      expect(nextPage.pageInfo.hasNextPage).toBe(false);
      expect(nextPage.items[0].id).toBe('msg3');
    });

    it('should filter by minimum score', async () => {
      const mockVectorResults = [
        { id: 'msg1', score: 0.9, metadata: { timestamp: '2024-01-01T00:00:00Z' } },
        { id: 'msg2', score: 0.8, metadata: { timestamp: '2024-01-02T00:00:00Z' } },
        { id: 'msg3', score: 0.3, metadata: { timestamp: '2024-01-03T00:00:00Z' } }  // Below threshold
      ];

      mockVectorStoreService.findSimilarMessages.mockResolvedValue(mockVectorResults);
      mockPrismaService.channelMember.findMany.mockResolvedValue([{ channelId: 'channel1' }]);
      
      const mockMessages = mockVectorResults.slice(0, 2).map(r => ({
        id: r.id,
        content: `Message ${r.id}`,
        channelId: 'channel1',
        createdAt: new Date(r.metadata.timestamp),
        user: { id: 'user1', name: 'Test User', imageUrl: 'test.jpg' }
      }));

      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

      const result = await service.searchMessages('user1', 'test query', { 
        minScore: 0.5 
      }) as SearchResult<MessageSearchResult>;

      expect(result.items.length).toBe(2);
      expect(result.items.every(m => m.score >= 0.5)).toBe(true);
      expect(result.total).toBe(2);
    });
  });

  describe('mapMessageWithScore', () => {
    const mockMessage: Message = {
      id: '1',
      content: 'test message',
      channelId: 'channel1',
      userId: 'user1',
      createdAt: new Date(),
      updatedAt: new Date(),
      replyToId: null,
      vectorId: null,
      deliveryStatus: MessageDeliveryStatus.SENT
    };

    it('should combine message with vector score', () => {
      const vectorResult = { id: '1', score: 0.8 };
      const result = service['mapMessageWithScore'](mockMessage, vectorResult);
      
      expect(result).toEqual({
        ...mockMessage,
        score: 0.8
      });
    });

    it('should default score to 0 if no vector result', () => {
      const result = service['mapMessageWithScore'](mockMessage);
      
      expect(result).toEqual({
        ...mockMessage,
        score: 0
      });
    });
  });
}); 