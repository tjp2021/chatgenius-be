import { Test, TestingModule } from '@nestjs/testing';
import { VectorStoreService } from '../lib/vector-store.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';

describe('RAG Search Tests', () => {
  let vectorStore: VectorStoreService;
  let pineconeService: PineconeService;
  let embeddingService: EmbeddingService;

  const mockEmbedding = Array(1536).fill(0.1);
  const currentTime = new Date().toISOString();
  const mockMessages = [
    { 
      id: 'msg1', 
      content: 'How do I reset my password?', 
      metadata: { 
        userId: 'user1', 
        channelId: 'channel1',
        timestamp: currentTime 
      } 
    },
    { 
      id: 'msg2', 
      content: 'The password reset option is in settings.', 
      metadata: { 
        userId: 'user2', 
        channelId: 'channel1',
        timestamp: currentTime, 
        replyTo: 'msg1' 
      } 
    },
    { 
      id: 'msg3', 
      content: 'What time is lunch today?', 
      metadata: { 
        userId: 'user3', 
        channelId: 'channel1',
        timestamp: currentTime 
      } 
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorStoreService,
        {
          provide: PineconeService,
          useValue: {
            upsertVector: jest.fn().mockResolvedValue(undefined),
            queryVectors: jest.fn().mockImplementation((vector, topK = 3) => {
              // Simple mock that returns password-related messages for password queries
              const isPasswordQuery = vector.some(v => v !== 0);
              return {
                matches: isPasswordQuery 
                  ? [
                      { 
                        id: 'msg1', 
                        score: 0.9, 
                        metadata: {
                          ...mockMessages[0].metadata,
                          originalScore: 0.9,
                          timeScore: 1,
                          threadScore: 1,
                          channelScore: 1
                        }, 
                        values: mockEmbedding 
                      },
                      { 
                        id: 'msg2', 
                        score: 0.85, 
                        metadata: {
                          ...mockMessages[1].metadata,
                          originalScore: 0.85,
                          timeScore: 1,
                          threadScore: 1,
                          channelScore: 1
                        }, 
                        values: mockEmbedding 
                      }
                    ]
                  : [],
                namespace: ''
              };
            })
          }
        },
        {
          provide: EmbeddingService,
          useValue: {
            createEmbedding: jest.fn().mockResolvedValue(mockEmbedding)
          }
        }
      ],
    }).compile();

    vectorStore = module.get<VectorStoreService>(VectorStoreService);
    pineconeService = module.get<PineconeService>(PineconeService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  describe('Basic RAG Functionality', () => {
    it('should store and retrieve relevant messages', async () => {
      // Store test messages
      for (const msg of mockMessages) {
        await vectorStore.storeMessage(msg.id, msg.content, msg.metadata);
      }

      // Search for password-related query
      const results = await vectorStore.findSimilarMessages('How to change password');

      // Verify we get relevant results
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results.some(r => r.id === 'msg1' || r.id === 'msg2')).toBeTruthy();
      
      // Verify score components in metadata
      expect(results[0].metadata.originalScore).toBeGreaterThan(0.8);
      expect(results[0].metadata.timeScore).toBeDefined();
    });

    it('should return empty results for unrelated queries', async () => {
      // Mock embedding service to return zero vector for unrelated query
      jest.spyOn(embeddingService, 'createEmbedding')
        .mockResolvedValueOnce(Array(1536).fill(0));

      const results = await vectorStore.findSimilarMessages('completely unrelated query');
      expect(results).toHaveLength(0);
    });
  });

  describe('Context-Aware Retrieval', () => {
    it('should retrieve messages with their context', async () => {
      // Store test messages
      for (const msg of mockMessages) {
        await vectorStore.storeMessage(msg.id, msg.content, msg.metadata);
      }

      // Override mock for this specific test
      jest.spyOn(pineconeService, 'queryVectors').mockResolvedValueOnce({
        matches: [
          { 
            id: 'msg2', 
            score: 0.9, 
            metadata: {
              ...mockMessages[1].metadata,
              originalScore: 0.9,
              timeScore: 1,
              threadScore: 1,
              channelScore: 1
            },
            values: mockEmbedding
          }
        ],
        namespace: ''
      });

      const results = await vectorStore.findSimilarMessages('where is the password reset?');

      // Verify we get the response with its context
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('msg2');
      expect(results[0].metadata.replyTo).toBe('msg1');  // Context link
    });
  });

  describe('Time-Based Scoring', () => {
    it('should factor in message recency when scoring', async () => {
      const recentTime = new Date().toISOString();
      const olderTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago

      // Mock messages with different timestamps but same semantic score
      jest.spyOn(pineconeService, 'queryVectors').mockResolvedValueOnce({
        matches: [
          { 
            id: 'recent', 
            score: 0.9, 
            metadata: { 
              ...mockMessages[0].metadata, 
              timestamp: recentTime,
              originalScore: 0.9,
              timeScore: 1,
              threadScore: 1,
              channelScore: 1
            },
            values: mockEmbedding
          },
          { 
            id: 'older', 
            score: 0.9, 
            metadata: { 
              ...mockMessages[0].metadata, 
              timestamp: olderTime,
              originalScore: 0.9,
              timeScore: 0.5,
              threadScore: 1,
              channelScore: 1
            },
            values: mockEmbedding
          }
        ],
        namespace: ''
      });

      const results = await vectorStore.findSimilarMessages('password reset');

      // Recent message should be scored higher
      expect(results[0].id).toBe('recent');
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].metadata.timeScore).toBeGreaterThan(results[1].metadata.timeScore);
      
      // Original semantic scores should be preserved
      expect(results[0].metadata.originalScore).toBe(0.9);
      expect(results[1].metadata.originalScore).toBe(0.9);
    });

    it('should handle missing timestamps gracefully', async () => {
      jest.spyOn(pineconeService, 'queryVectors').mockResolvedValueOnce({
        matches: [
          { 
            id: 'msg1', 
            score: 0.9, 
            metadata: { 
              userId: 'user1',
              channelId: 'channel1',
              originalScore: 0.9,
              timeScore: 1,
              threadScore: 1,
              channelScore: 1
            },
            values: mockEmbedding
          }
        ],
        namespace: ''
      });

      const results = await vectorStore.findSimilarMessages('test query');
      
      expect(results[0].score).toBe(0.9);
      expect(results[0].metadata.timeScore).toBe(1); // Default time score
    });
  });
}); 