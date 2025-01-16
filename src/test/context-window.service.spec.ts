import { Test, TestingModule } from '@nestjs/testing';
import { ContextWindowService } from '../lib/context-window.service';
import { PrismaService } from '../lib/prisma.service';
import { VectorStoreService } from '../lib/vector-store.service';

describe('ContextWindowService', () => {
  let service: ContextWindowService;
  let prismaService: PrismaService;
  let vectorStore: VectorStoreService;

  const mockPrismaService = {
    message: {
      findUnique: jest.fn()
    }
  };

  const mockVectorStore = {
    findSimilarMessages: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextWindowService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: VectorStoreService,
          useValue: mockVectorStore
        }
      ],
    }).compile();

    service = module.get<ContextWindowService>(ContextWindowService);
    prismaService = module.get<PrismaService>(PrismaService);
    vectorStore = module.get<VectorStoreService>(VectorStoreService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('getContextWindow', () => {
    const mockMessages = [
      {
        id: 'msg-1',
        content: 'Message 1',
        createdAt: new Date('2024-01-15T00:00:00Z'),
        channelId: 'channel-1'
      },
      {
        id: 'msg-2',
        content: 'Message 2',
        createdAt: new Date('2024-01-15T00:01:00Z'),
        channelId: 'channel-2'
      }
    ];

    const mockVectorResults = [
      {
        id: 'msg-1',
        score: 0.9,
        metadata: {
          channelId: 'channel-1',
          content: 'Message 1'
        },
        originalScore: 0.9,
        timeScore: 1.0,
        channelScore: 1.5
      },
      {
        id: 'msg-2',
        score: 0.8,
        metadata: {
          channelId: 'channel-2',
          content: 'Message 2'
        },
        originalScore: 0.8,
        timeScore: 0.9,
        channelScore: 1.0
      }
    ];

    beforeEach(() => {
      mockPrismaService.message.findUnique
        .mockImplementation((query) => {
          const message = mockMessages.find(m => m.id === query.where.id);
          return Promise.resolve(message || null);
        });
    });

    it('should get context from single channel', async () => {
      mockVectorStore.findSimilarMessages.mockResolvedValue([mockVectorResults[0]]);

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test query'
      });

      expect(vectorStore.findSimilarMessages).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({
          channelIds: ['channel-1'],
          minScore: 0.7
        })
      );

      expect(result.messages).toHaveLength(1);
      expect(result.channels).toEqual(new Set(['channel-1']));
      expect(result.messages[0]).toMatchObject({
        id: 'msg-1',
        channelId: 'channel-1',
        channelScore: 1.5
      });
    });

    it('should get context from related channels', async () => {
      mockVectorStore.findSimilarMessages
        .mockResolvedValueOnce(mockVectorResults) // For finding related channels
        .mockResolvedValueOnce(mockVectorResults); // For actual search

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test query',
        includeRelatedChannels: true
      });

      expect(result.messages).toHaveLength(2);
      expect(result.channels).toEqual(new Set(['channel-1', 'channel-2']));
      expect(result.messages[0].channelScore).toBe(1.5); // Same channel boost
      expect(result.messages[1].channelScore).toBe(1.0); // No boost
    });

    it('should respect token limit', async () => {
      // Each message is about 8 tokens (32 chars)
      const longMessage = {
        id: 'msg-3',
        score: 0.9,
        metadata: {
          channelId: 'channel-1',
          content: 'A'.repeat(200) // About 50 tokens
        },
        originalScore: 0.9,
        timeScore: 1.0,
        channelScore: 1.5
      };

      mockVectorStore.findSimilarMessages.mockResolvedValue([longMessage]);
      mockPrismaService.message.findUnique.mockResolvedValue({
        id: 'msg-3',
        content: 'A'.repeat(200),
        createdAt: new Date(),
        channelId: 'channel-1'
      });

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test query',
        maxTokens: 60 // Only enough for the long message
      });

      expect(result.messages).toHaveLength(1);
      expect(result.totalTokens).toBe(50);
    });

    it('should include parent message context', async () => {
      const messageWithParent = {
        id: 'msg-1',
        score: 0.9,
        metadata: {
          channelId: 'channel-1',
          content: 'Reply message'
        },
        originalScore: 0.9,
        timeScore: 1.0,
        channelScore: 1.5,
        context: {
          parentMessage: {
            id: 'parent-1',
            metadata: {
              content: 'Parent message',
              channelId: 'channel-1'
            }
          }
        }
      };

      mockVectorStore.findSimilarMessages.mockResolvedValue([messageWithParent]);
      mockPrismaService.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        content: 'Reply message',
        createdAt: new Date(),
        channelId: 'channel-1'
      });

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test query'
      });

      expect(result.messages[0].context).toBeDefined();
      expect(result.messages[0].context?.parentMessage).toMatchObject({
        id: 'parent-1',
        content: 'Parent message',
        channelId: 'channel-1'
      });
    });

    it('should filter messages by minimum score', async () => {
      const lowScoreMessage = {
        id: 'msg-3',
        score: 0.5, // Below default minimum of 0.7
        metadata: {
          channelId: 'channel-1',
          content: 'Low score message'
        },
        originalScore: 0.5,
        timeScore: 1.0,
        channelScore: 1.5
      };

      mockVectorStore.findSimilarMessages.mockResolvedValue([mockVectorResults[0], lowScoreMessage]);

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test query',
        minScore: 0.7
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].id).toBe('msg-1');
    });

    it('should handle errors gracefully', async () => {
      mockVectorStore.findSimilarMessages.mockRejectedValue(new Error('Search failed'));

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test query'
      });

      expect(result.messages).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.channels.size).toBe(1);
    });

    it('should boost scores for messages from same channel', async () => {
      const sameChannelMsg = {
        id: 'msg-1',
        score: 0.8,
        metadata: {
          channelId: 'channel-1',
          content: 'Same channel'
        },
        originalScore: 0.8,
        timeScore: 1.0,
        channelScore: 1.5
      };

      const otherChannelMsg = {
        id: 'msg-2',
        score: 0.9,
        metadata: {
          channelId: 'channel-2',
          content: 'Other channel'
        },
        originalScore: 0.9,
        timeScore: 1.0,
        channelScore: 1.0
      };

      mockVectorStore.findSimilarMessages.mockResolvedValue([sameChannelMsg, otherChannelMsg]);
      mockPrismaService.message.findUnique.mockImplementation((query) => {
        return Promise.resolve({
          id: query.where.id,
          content: query.where.id === 'msg-1' ? 'Same channel' : 'Other channel',
          createdAt: new Date(),
          channelId: query.where.id === 'msg-1' ? 'channel-1' : 'channel-2'
        });
      });

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test'
      });

      expect(result.messages[0].channelScore).toBe(1.5);
      expect(result.messages[1].channelScore).toBe(1.0);
    });

    it('should limit related channels to maximum specified', async () => {
      const mockResults = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        score: 0.9,
        metadata: {
          channelId: `channel-${i}`,
          content: `Message ${i}`
        },
        originalScore: 0.9,
        timeScore: 1.0,
        channelScore: 1.0
      }));

      mockVectorStore.findSimilarMessages
        .mockResolvedValueOnce(mockResults)  // For finding related channels
        .mockResolvedValueOnce(mockResults); // For actual search

      const result = await service.getContextWindow({
        channelId: 'channel-0',
        prompt: 'test',
        includeRelatedChannels: true
      });

      // Should include original channel + 3 related channels (RELATED_CHANNELS_LIMIT)
      expect(result.channels.size).toBeLessThanOrEqual(4);
    });

    it('should handle database errors gracefully', async () => {
      mockVectorStore.findSimilarMessages.mockResolvedValue([mockVectorResults[0]]);
      mockPrismaService.message.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test'
      });

      expect(result.messages).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.channels.size).toBe(1);
    });

    it('should handle empty search results', async () => {
      mockVectorStore.findSimilarMessages.mockResolvedValue([]);

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test'
      });

      expect(result.messages).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.channels.size).toBe(1);
    });

    it('should handle invalid message IDs', async () => {
      mockVectorStore.findSimilarMessages.mockResolvedValue([{
        id: 'invalid-id',
        score: 0.9,
        metadata: {
          channelId: 'channel-1',
          content: 'Invalid message'
        },
        originalScore: 0.9,
        timeScore: 1.0,
        channelScore: 1.5
      }]);
      mockPrismaService.message.findUnique.mockResolvedValue(null);

      const result = await service.getContextWindow({
        channelId: 'channel-1',
        prompt: 'test'
      });

      expect(result.messages).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });
  });
}); 