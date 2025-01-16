import { Test, TestingModule } from '@nestjs/testing';
import { ContextWindowService } from '../lib/context-window.service';
import { PrismaService } from '../lib/prisma.service';
import { VectorStoreService } from '../lib/vector-store.service';
import { Message, MessageDeliveryStatus, Prisma } from '@prisma/client';
import { jest } from '@jest/globals';

interface VectorResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    channelId: string;
    content: string;
    originalScore: number;
    timeScore: number;
    channelScore: number;
    threadScore: number;
    chunkIndex: number;
    totalChunks: number;
    messageId: string;
    userId: string;
    timestamp: string;
    replyTo: string | null;
  };
  context: {
    parentMessage: {
      id: string;
      metadata: {
        content: string;
        channelId: string;
      };
    };
  };
}

describe('ContextWindowService', () => {
  let service: ContextWindowService;
  let prismaService: jest.Mocked<PrismaService>;
  let vectorStore: jest.Mocked<VectorStoreService>;

  beforeEach(async () => {
    // Create mock services with proper types
    prismaService = {
      message: {
        findUnique: jest.fn()
      }
    } as any;

    vectorStore = {
      findSimilarMessages: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextWindowService,
        { provide: PrismaService, useValue: prismaService },
        { provide: VectorStoreService, useValue: vectorStore }
      ],
    }).compile();

    service = module.get<ContextWindowService>(ContextWindowService);
  });

  describe('getContextWindow', () => {
    const mockMessages = [
      {
        id: 'msg-1',
        content: 'Message 1',
        createdAt: new Date('2024-01-15T00:00:00Z'),
        updatedAt: new Date('2024-01-15T00:00:00Z'),
        channelId: 'channel-1',
        userId: 'user-1',
        replyToId: null,
        deliveryStatus: MessageDeliveryStatus.DELIVERED
      },
      {
        id: 'msg-2',
        content: 'Message 2',
        createdAt: new Date('2024-01-15T00:01:00Z'),
        updatedAt: new Date('2024-01-15T00:01:00Z'),
        channelId: 'channel-2',
        userId: 'user-2',
        replyToId: null,
        deliveryStatus: MessageDeliveryStatus.DELIVERED
      }
    ];

    const mockVectorResults: VectorResult[] = [
      {
        id: 'msg-1',
        content: 'Message 1',
        score: 0.9,
        metadata: {
          channelId: 'channel-1',
          content: 'Message 1',
          originalScore: 0.9,
          timeScore: 1.0,
          channelScore: 1.5,
          threadScore: 1.0,
          chunkIndex: 0,
          totalChunks: 1,
          messageId: 'msg-1',
          userId: 'user-1',
          timestamp: new Date('2024-01-15T00:00:00Z').toISOString(),
          replyTo: null
        },
        context: {
          parentMessage: {
            id: 'parent-1',
            metadata: {
              content: 'Parent Message 1',
              channelId: 'channel-1'
            }
          }
        }
      },
      {
        id: 'msg-2',
        content: 'Message 2',
        score: 0.8,
        metadata: {
          channelId: 'channel-2',
          content: 'Message 2',
          originalScore: 0.8,
          timeScore: 0.9,
          channelScore: 1.0,
          threadScore: 1.0,
          chunkIndex: 0,
          totalChunks: 1,
          messageId: 'msg-2',
          userId: 'user-2',
          timestamp: new Date('2024-01-15T00:01:00Z').toISOString(),
          replyTo: null
        },
        context: {
          parentMessage: {
            id: 'parent-2',
            metadata: {
              content: 'Parent Message 2',
              channelId: 'channel-2'
            }
          }
        }
      }
    ];

    beforeEach(() => {
      (prismaService.message.findUnique as jest.Mock).mockImplementation((args: Prisma.MessageFindUniqueArgs) => {
        const message = mockMessages.find(m => m.id === args.where.id);
        if (!message) return null;

        return message;
      });
    });

    it('should get context from single channel', async () => {
      vectorStore.findSimilarMessages.mockResolvedValue([mockVectorResults[0]]);

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

    it('should prioritize messages based on importance to query', async () => {
      const mockImportanceResults: VectorResult[] = [
        {
          id: 'msg1',
          content: 'API endpoint is down',
          score: 0.7,
          metadata: {
            originalScore: 0.7,
            timeScore: 1.0,
            channelScore: 1.5,
            threadScore: 1.0,
            content: 'API endpoint is down',
            chunkIndex: 0,
            totalChunks: 1,
            messageId: 'msg1',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString(),
            replyTo: null
          },
          context: {
            parentMessage: {
              id: 'parent1',
              metadata: {
                content: 'Parent Message 1',
                channelId: 'channel1'
              }
            }
          }
        },
        {
          id: 'msg2',
          content: 'Which API endpoint?',
          score: 0.6,
          metadata: {
            originalScore: 0.6,
            timeScore: 1.0,
            channelScore: 1.5,
            threadScore: 1.0,
            content: 'Which API endpoint?',
            chunkIndex: 0,
            totalChunks: 1,
            messageId: 'msg2',
            channelId: 'channel1',
            userId: 'user2',
            timestamp: new Date().toISOString(),
            replyTo: 'msg1'
          },
          context: {
            parentMessage: {
              id: 'msg1',
              metadata: {
                content: 'API endpoint is down',
                channelId: 'channel1'
              }
            }
          }
        },
        {
          id: 'msg3',
          content: 'Unrelated message about lunch',
          score: 0.3,
          metadata: {
            originalScore: 0.3,
            timeScore: 1.0,
            channelScore: 1.5,
            threadScore: 1.0,
            content: 'Unrelated message about lunch',
            chunkIndex: 0,
            totalChunks: 1,
            messageId: 'msg3',
            channelId: 'channel1',
            userId: 'user3',
            timestamp: new Date().toISOString(),
            replyTo: null
          },
          context: {
            parentMessage: {
              id: 'parent3',
              metadata: {
                content: 'Parent Message 3',
                channelId: 'channel1'
              }
            }
          }
        }
      ];

      // Mock vector store to return our test messages
      vectorStore.findSimilarMessages.mockResolvedValue(mockImportanceResults);

      // Mock message content retrieval
      (prismaService.message.findUnique as jest.Mock).mockImplementation((args: Prisma.MessageFindUniqueArgs) => {
        const msg = mockImportanceResults.find(m => m.id === args.where.id);
        if (!msg) return null;

        return {
          id: msg.id,
          content: msg.metadata.content,
          createdAt: new Date(msg.metadata.timestamp),
          updatedAt: new Date(msg.metadata.timestamp),
          channelId: msg.metadata.channelId,
          userId: msg.metadata.userId,
          replyToId: msg.metadata.replyTo || null,
          deliveryStatus: MessageDeliveryStatus.DELIVERED
        } as Message;
      });

      const result = await service.getContextWindow({
        channelId: 'channel1',
        prompt: 'API endpoint issues',
        maxTokens: 100 // Small limit to force prioritization
      });

      // Verify messages are ordered by importance
      expect(result.messages[0].id).toBe('msg1'); // Most relevant to query
      expect(result.messages[1].id).toBe('msg2'); // Reply to most relevant
      expect(result.messages).toHaveLength(2); // msg3 should be excluded due to low importance
      
      // Verify scores are properly calculated
      expect(result.messages[0].score).toBeGreaterThan(result.messages[1].score);
      expect(result.messages[0].score).toBeGreaterThan(mockImportanceResults[0].score);
    });
  });
}); 