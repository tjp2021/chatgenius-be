import { Test, TestingModule } from '@nestjs/testing';
import { VectorStoreService } from '../lib/vector-store.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';
import { TextChunkingService } from '../lib/text-chunking.service';

describe('VectorStoreService Real World Tests', () => {
  let service: VectorStoreService;
  let pineconeService: jest.Mocked<PineconeService>;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let textChunkingService: jest.Mocked<TextChunkingService>;

  beforeEach(async () => {
    pineconeService = {
      upsertVector: jest.fn(),
      upsertVectors: jest.fn(),
      queryVectors: jest.fn(),
      getVectorById: jest.fn(),
    } as any;

    embeddingService = {
      createEmbedding: jest.fn(),
    } as any;

    textChunkingService = {
      chunkText: jest.fn(),
      reconstructText: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorStoreService,
        { provide: PineconeService, useValue: pineconeService },
        { provide: EmbeddingService, useValue: embeddingService },
        { provide: TextChunkingService, useValue: textChunkingService },
      ],
    }).compile();

    service = module.get<VectorStoreService>(VectorStoreService);
  });

  it('should handle real-world conversation context', async () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    
    // Mock a real conversation
    const mockMessages = [
      {
        id: 'msg1',
        score: 0.85,
        values: [],
        metadata: {
          messageId: 'msg1',
          content: 'How do I implement authentication in my React app?',
          channelId: 'tech-help',
          userId: 'user1',
          timestamp: tenMinutesAgo.toISOString(),
          chunkIndex: 0,
          totalChunks: 1
        }
      },
      {
        id: 'msg2',
        score: 0.75,
        values: [],
        metadata: {
          messageId: 'msg2',
          content: 'You can use JWT tokens with a library like Auth0',
          channelId: 'tech-help',
          userId: 'user2',
          replyTo: 'msg1',
          timestamp: fiveMinutesAgo.toISOString(),
          chunkIndex: 0,
          totalChunks: 1
        }
      },
      {
        id: 'msg3',
        score: 0.95,
        values: [],
        metadata: {
          messageId: 'msg3',
          content: 'Authentication best practices for React',
          channelId: 'general',
          userId: 'user3',
          timestamp: now.toISOString(),
          chunkIndex: 0,
          totalChunks: 1
        }
      }
    ];

    // Mock embedding service
    embeddingService.createEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

    // Mock Pinecone response
    pineconeService.queryVectors.mockResolvedValue({
      matches: mockMessages,
      namespace: ''
    });

    // Search query
    const results = await service.findSimilarMessages(
      'How to add authentication to React?',
      { channelId: 'tech-help' }
    );

    // Log scores for debugging
    results.messages.forEach(msg => {
      console.log(`Message ${msg.id}:`, {
        finalScore: msg.score,
        originalScore: msg.metadata.originalScore,
        timeScore: msg.metadata.timeScore,
        channelScore: msg.metadata.channelScore,
        threadScore: msg.metadata.threadScore,
        combinedFactors: msg.metadata.timeScore * msg.metadata.channelScore * msg.metadata.threadScore
      });
    });

    // Process results
    results.messages.forEach(msg => {
      expect(msg.score).toBeGreaterThan(0.5);
      expect(msg.metadata.channelId).toBeDefined();
      expect(msg.metadata.userId).toBeDefined();
      expect(msg.metadata.timestamp).toBeDefined();
    });

    // Verify ordering
    const [first, second, third] = results.messages;
    expect(first.score).toBeGreaterThan(second.score);
    expect(second.score).toBeGreaterThan(third.score);
  });
}); 