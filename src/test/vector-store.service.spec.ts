import { Test, TestingModule } from '@nestjs/testing';
import { VectorStoreService } from '../lib/vector-store.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';

interface TestMessage {
  id: string;
  score: number;
  metadata: any;
  originalScore: number;
  timeScore: number;
  channelScore: number;
  context?: {
    parentMessage: {
      id: string;
      metadata: any;
    };
  };
}

describe('VectorStoreService', () => {
  let service: VectorStoreService;
  let pineconeService: PineconeService;
  let embeddingService: EmbeddingService;

  const mockPineconeService = {
    upsertVector: jest.fn(),
    upsertVectors: jest.fn(),
    queryVectors: jest.fn(),
    getVectorById: jest.fn()
  };

  const mockEmbeddingService = {
    createEmbedding: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorStoreService,
        {
          provide: PineconeService,
          useValue: mockPineconeService
        },
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService
        }
      ],
    }).compile();

    service = module.get<VectorStoreService>(VectorStoreService);
    pineconeService = module.get<PineconeService>(PineconeService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('storeMessage', () => {
    it('should store message with channel metadata', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding);

      const metadata = {
        channelId: 'channel-1',
        userId: 'user-1',
        timestamp: '2024-01-15T00:00:00Z'
      };

      await service.storeMessage('msg-1', 'test content', metadata);

      expect(mockPineconeService.upsertVector).toHaveBeenCalledWith(
        'msg-1',
        mockEmbedding,
        expect.objectContaining({
          channelId: 'channel-1',
          userId: 'user-1',
          timestamp: '2024-01-15T00:00:00Z'
        })
      );
    });

    it('should throw error if channelId is missing', async () => {
      const metadata = {
        userId: 'user-1',
        timestamp: '2024-01-15T00:00:00Z'
      };

      await expect(service.storeMessage('msg-1', 'test content', metadata as any))
        .rejects
        .toThrow('channelId is required in metadata');
    });
  });

  describe('storeMessages', () => {
    it('should store multiple messages with channel metadata', async () => {
      const mockEmbeddings = [[0.1], [0.2]];
      mockEmbeddingService.createEmbedding
        .mockResolvedValueOnce(mockEmbeddings[0])
        .mockResolvedValueOnce(mockEmbeddings[1]);

      const messages = [
        {
          id: 'msg-1',
          content: 'test 1',
          metadata: {
            channelId: 'channel-1',
            userId: 'user-1',
            timestamp: '2024-01-15T00:00:00Z'
          }
        },
        {
          id: 'msg-2',
          content: 'test 2',
          metadata: {
            channelId: 'channel-2',
            userId: 'user-2',
            timestamp: '2024-01-15T00:00:00Z'
          }
        }
      ];

      await service.storeMessages(messages);

      expect(mockPineconeService.upsertVectors).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'msg-1',
            values: mockEmbeddings[0],
            metadata: expect.objectContaining({ channelId: 'channel-1' })
          }),
          expect.objectContaining({
            id: 'msg-2',
            values: mockEmbeddings[1],
            metadata: expect.objectContaining({ channelId: 'channel-2' })
          })
        ])
      );
    });
  });

  describe('findSimilarMessages', () => {
    const mockQueryResponse = {
      matches: [
        {
          id: 'msg-1',
          score: 0.9,
          metadata: {
            channelId: 'channel-1',
            userId: 'user-1',
            timestamp: '2024-01-15T00:00:00Z'
          }
        },
        {
          id: 'msg-2',
          score: 0.8,
          metadata: {
            channelId: 'channel-2',
            userId: 'user-2',
            timestamp: '2024-01-15T00:00:00Z'
          }
        }
      ]
    };

    beforeEach(() => {
      mockEmbeddingService.createEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockPineconeService.queryVectors.mockResolvedValue(mockQueryResponse);
    });

    it('should filter by single channel', async () => {
      await service.findSimilarMessages('test query', { channelId: 'channel-1' });

      expect(mockPineconeService.queryVectors).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Number),
        expect.objectContaining({
          filter: { channelId: { $eq: 'channel-1' } }
        })
      );
    });

    it('should filter by multiple channels', async () => {
      await service.findSimilarMessages('test query', {
        channelIds: ['channel-1', 'channel-2']
      });

      expect(mockPineconeService.queryVectors).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Number),
        expect.objectContaining({
          filter: { channelId: { $in: ['channel-1', 'channel-2'] } }
        })
      );
    });

    it('should apply channel boost to same-channel messages', async () => {
      const results = await service.findSimilarMessages('test query', {
        channelId: 'channel-1'
      });

      const channel1Message = results.find(msg => msg.metadata.channelId === 'channel-1');
      const channel2Message = results.find(msg => msg.metadata.channelId === 'channel-2');

      expect(channel1Message.channelScore).toBe(1.5); // CHANNEL_BOOST_FACTOR
      expect(channel2Message.channelScore).toBe(1); // No boost
    });

    it('should filter out messages below minimum score', async () => {
      mockPineconeService.queryVectors.mockResolvedValue({
        matches: [
          {
            id: 'msg-1',
            score: 0.9,
            metadata: {
              channelId: 'channel-1',
              timestamp: '2024-01-15T00:00:00Z'
            }
          },
          {
            id: 'msg-2',
            score: 0.5, // Below default minimum of 0.7
            metadata: {
              channelId: 'channel-1',
              timestamp: '2024-01-15T00:00:00Z'
            }
          }
        ]
      });

      const results = await service.findSimilarMessages('test query');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('msg-1');
    });

    it('should include parent message context when replyTo is present', async () => {
      const mockParentMessage = {
        id: 'parent-1',
        metadata: {
          content: 'parent content',
          channelId: 'channel-1'
        }
      };

      mockPineconeService.queryVectors.mockResolvedValue({
        matches: [
          {
            id: 'msg-1',
            score: 0.9,
            metadata: {
              channelId: 'channel-1',
              timestamp: '2024-01-15T00:00:00Z',
              replyTo: 'parent-1'
            }
          }
        ]
      });

      mockPineconeService.getVectorById.mockResolvedValue(mockParentMessage);

      const results = await service.findSimilarMessages('test query');
      const firstResult = results[0] as TestMessage;
      expect(firstResult.context).toBeDefined();
      expect(firstResult.context?.parentMessage.id).toBe('parent-1');
    });
  });
}); 