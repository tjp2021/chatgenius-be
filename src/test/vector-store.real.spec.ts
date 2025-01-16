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
    results.forEach(msg => {
      console.log(`Message ${msg.id}:`, {
        finalScore: msg.score,
        originalScore: msg.metadata.originalScore,
        timeScore: msg.metadata.timeScore,
        channelScore: msg.metadata.channelScore,
        threadScore: msg.metadata.threadScore,
        combinedFactors: msg.metadata.timeScore * msg.metadata.channelScore * msg.metadata.threadScore
      });
    });

    // Verify results
    expect(results).toHaveLength(3);

    // Message 2 should be ranked highest because:
    // - Part of a thread about authentication
    // - In the same channel
    // - Relatively recent
    const [first, second, third] = results;
    
    expect(first.id).toBe('msg2');
    expect(first.metadata.threadScore).toBe(1.5); // Thread boost
    expect(first.metadata.channelScore).toBe(1.2); // Channel boost
    
    // Message 1 should be second because:
    // - Part of same thread
    // - Same channel
    // - But older
    expect(second.id).toBe('msg1');
    expect(second.metadata.threadScore).toBe(1.5);
    expect(second.metadata.channelScore).toBe(1.2);
    
    // Message 3 should be last despite highest raw score because:
    // - Different channel
    // - Not in thread
    expect(third.id).toBe('msg3');
    expect(third.metadata.threadScore).toBe(1.0); // No thread boost
    expect(third.metadata.channelScore).toBe(1.0); // No channel boost
  });
}); 