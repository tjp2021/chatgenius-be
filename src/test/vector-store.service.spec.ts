import { Test, TestingModule } from '@nestjs/testing';
import { VectorStoreService, MessageMetadata, MessageBatch } from '../lib/vector-store.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';
import { TextChunkingService } from '../lib/text-chunking.service';

describe('VectorStoreService', () => {
  let service: VectorStoreService;
  let pineconeService: jest.Mocked<PineconeService>;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let textChunkingService: jest.Mocked<TextChunkingService>;

  beforeEach(async () => {
    // Create mock services
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

  describe('storeMessage', () => {
    it('should chunk message and store each chunk with embedding', async () => {
      const messageId = 'test123';
      const content = 'Test message content';
      const metadata: MessageMetadata = {
        channelId: 'channel123',
        userId: 'user123',
        timestamp: new Date().toISOString()
      };

      // Mock chunking service to return two chunks
      const mockChunks = [
        {
          content: 'Test content 1',
          metadata: {
            messageId: 'msg1',
            chunkIndex: 0,
            totalChunks: 2,
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString(),
            content: 'Test content 1'
          }
        },
        {
          content: 'Test content 2',
          metadata: {
            messageId: 'msg1',
            chunkIndex: 1,
            totalChunks: 2,
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString(),
            content: 'Test content 2'
          }
        }
      ];
      jest.spyOn(textChunkingService, 'chunkText').mockReturnValue(mockChunks);

      // Mock embedding service
      const mockEmbedding = [0.1, 0.2, 0.3];
      jest.spyOn(embeddingService, 'createEmbedding').mockResolvedValue(mockEmbedding);

      // Mock pinecone service
      jest.spyOn(pineconeService, 'upsertVectors').mockResolvedValue();

      await service.storeMessage(messageId, content, metadata);

      // Verify chunks were created
      expect(textChunkingService.chunkText).toHaveBeenCalledWith(content, {
        messageId,
        ...metadata
      });

      // Verify embeddings were created
      expect(embeddingService.createEmbedding).toHaveBeenCalledTimes(2);

      // Verify vectors were stored in batch
      expect(pineconeService.upsertVectors).toHaveBeenCalledTimes(1);
      expect(pineconeService.upsertVectors).toHaveBeenCalledWith([
        {
          id: `${messageId}_chunk_0`,
          values: mockEmbedding,
          metadata: mockChunks[0].metadata
        },
        {
          id: `${messageId}_chunk_1`,
          values: mockEmbedding,
          metadata: mockChunks[1].metadata
        }
      ]);
    });

    it('should throw error if channelId is missing', async () => {
      const messageId = 'test123';
      const content = 'Test message content';
      const metadata: Partial<MessageMetadata> = {
        userId: 'user123',
        timestamp: new Date().toISOString()
      };

      await expect(service.storeMessage(messageId, content, metadata as MessageMetadata))
        .rejects
        .toThrow('All messages must have channelId in metadata');
    });
  });

  describe('findSimilarMessages', () => {
    it('should find similar messages', async () => {
      const mockResults = {
        matches: [
          {
            id: 'msg1',
            score: 0.8,
            values: [],
            metadata: {
              messageId: 'msg1',
              content: 'Test message 1',
              channelId: 'channel1',
              userId: 'user1',
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'msg2',
            score: 0.7,
            values: [],
            metadata: {
              messageId: 'msg2',
              content: 'Test message 2',
              channelId: 'channel1',
              userId: 'user2',
              timestamp: new Date().toISOString()
            }
          }
        ],
        namespace: ''
      };

      pineconeService.queryVectors.mockResolvedValue(mockResults);
      
      const result = await service.findSimilarMessages('test query');
      
      expect(result.messages.length).toBe(2);
      const firstMessage = result.messages[0];
      const secondMessage = result.messages[1];
      
      expect(firstMessage.id).toBe('msg1');
      expect(secondMessage.id).toBe('msg2');
      expect(firstMessage.score).toBeGreaterThan(0.5);
      expect(secondMessage.score).toBeGreaterThan(0.5);
    });

    it('should handle thread messages', async () => {
      const mockResults = {
        matches: [
          {
            id: 'msg1',
            score: 0.8,
            values: [],
            metadata: {
              messageId: 'msg1',
              content: 'Thread message 1',
              channelId: 'channel1',
              userId: 'user1',
              replyTo: 'thread1',
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'msg2',
            score: 0.7,
            values: [],
            metadata: {
              messageId: 'msg2',
              content: 'Thread message 2',
              channelId: 'channel1',
              userId: 'user2',
              replyTo: 'thread1',
              timestamp: new Date().toISOString()
            }
          }
        ],
        namespace: ''
      };

      pineconeService.queryVectors.mockResolvedValue(mockResults);
      
      const result = await service.findSimilarMessages('thread test');
      
      expect(result.messages.length).toBe(2);
      const firstMessage = result.messages[0];
      const secondMessage = result.messages[1];
      
      expect(firstMessage.metadata.replyTo).toBe('thread1');
      expect(secondMessage.metadata.replyTo).toBe('thread1');
    });

    it('should handle incomplete or malformed chunks gracefully', async () => {
      const searchQuery = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      
      embeddingService.createEmbedding.mockResolvedValue(mockEmbedding);

      // Mock chunks with missing middle chunk and malformed metadata
      const mockResults = {
        matches: [
          {
            id: 'msg1_chunk_0',
            score: 0.9,
            values: mockEmbedding,
            metadata: {
              messageId: 'msg1',
              chunkIndex: 0,
              totalChunks: 3,
              content: 'First part',
              channelId: 'channel1',
              userId: 'user1',
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'msg1_chunk_2',
            score: 0.85,
            values: mockEmbedding,
            metadata: {
              messageId: 'msg1',
              chunkIndex: 2,
              totalChunks: 3,
              content: 'Third part',
              channelId: 'channel1',
              userId: 'user1',
              timestamp: new Date().toISOString()
            }
          }
        ],
        namespace: ''
      };

      pineconeService.queryVectors.mockResolvedValue(mockResults);
      textChunkingService.reconstructText.mockReturnValue('First part Third part');

      const result = await service.findSimilarMessages(searchQuery, {
        channelId: 'channel1',
        topK: 5
      });

      // Should return the reconstructed message
      expect(result.messages.length).toBe(1);
      const message = result.messages[0];
      
      expect(message.id).toBe('msg1');
      expect(message.content).toBe('First part Third part');
      expect(message.metadata.originalScore).toBe(0.9); // Should use max score
    });

    it('should handle out-of-order and duplicate chunks correctly', async () => {
      const searchQuery = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      
      embeddingService.createEmbedding.mockResolvedValue(mockEmbedding);

      // Mock chunks returned in random order
      const mockResults = {
        matches: [
          {
            id: 'msg1_chunk_2',
            score: 0.88,
            values: mockEmbedding,
            metadata: {
              messageId: 'msg1',
              chunkIndex: 2,
              totalChunks: 3,
              content: 'Third part',
              channelId: 'channel1',
              userId: 'user1',
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'msg1_chunk_0',
            score: 0.92,
            values: mockEmbedding,
            metadata: {
              messageId: 'msg1',
              chunkIndex: 0,
              totalChunks: 3,
              content: 'First part',
              channelId: 'channel1',
              userId: 'user1',
              timestamp: new Date().toISOString()
            }
          },
          {
            id: 'msg1_chunk_1',
            score: 0.90,
            values: mockEmbedding,
            metadata: {
              messageId: 'msg1',
              chunkIndex: 1,
              totalChunks: 3,
              content: 'Second part',
              channelId: 'channel1',
              userId: 'user1',
              timestamp: new Date().toISOString()
            }
          }
        ],
        namespace: ''
      };

      pineconeService.queryVectors.mockResolvedValue(mockResults);
      textChunkingService.reconstructText.mockReturnValue('First part Second part Third part');

      const result = await service.findSimilarMessages(searchQuery, {
        channelId: 'channel1',
        topK: 5
      });

      // Should combine chunks into single message
      expect(result.messages.length).toBe(1);
      const message = result.messages[0];
      
      expect(message.id).toBe('msg1');
      expect(message.content).toBe('First part Second part Third part');
      expect(message.metadata.originalScore).toBe(0.92); // Should use highest chunk score
    });

    it('should handle various scoring edge cases correctly', async () => {
      const searchQuery = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      embeddingService.createEmbedding.mockResolvedValue(mockEmbedding);

      // Create messages with various scoring scenarios
      const mockChunks = [
        // Message 1: Recent message, mixed chunk scores, same channel
        {
          id: 'msg1_chunk_0',
          score: 0.95, // High score chunk
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 0,
            totalChunks: 2,
            content: 'first chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: now.toISOString()
          }
        },
        {
          id: 'msg1_chunk_1',
          score: 0.65, // Below minScore (0.7) but message should still appear
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 1,
            totalChunks: 2,
            content: 'second chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: now.toISOString()
          }
        },
        // Message 2: Older message, high scores, different channel
        {
          id: 'msg2_chunk_0',
          score: 0.98,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg2',
            chunkIndex: 0,
            totalChunks: 2,
            content: 'first chunk',
            channelId: 'channel2', // Different channel
            userId: 'user1',
            timestamp: oneHourAgo.toISOString()
          }
        },
        {
          id: 'msg2_chunk_1',
          score: 0.92,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg2',
            chunkIndex: 1,
            totalChunks: 2,
            content: 'second chunk',
            channelId: 'channel2',
            userId: 'user1',
            timestamp: oneHourAgo.toISOString()
          }
        },
        // Message 3: Oldest message, all chunks below minScore
        {
          id: 'msg3_chunk_0',
          score: 0.55,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg3',
            chunkIndex: 0,
            totalChunks: 2,
            content: 'first chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: twoHoursAgo.toISOString()
          }
        },
        {
          id: 'msg3_chunk_1',
          score: 0.50,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg3',
            chunkIndex: 1,
            totalChunks: 2,
            content: 'second chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: twoHoursAgo.toISOString()
          }
        }
      ];

      pineconeService.queryVectors.mockResolvedValue({
        matches: mockChunks,
        namespace: ''
      });

      const results = await service.findSimilarMessages(searchQuery, {
        channelId: 'channel1', // Search in channel1
        topK: 5,
        minScore: 0.6
      });

      // Should only return messages with max score above minScore
      expect(results).toHaveLength(2); // msg1 and msg2 only, msg3 filtered out

      // Verify message ordering based on combined scores
      const firstResult = results[0];
      const secondResult = results[1];

      // Message 1 should be first despite lower raw score because:
      // - It's more recent (higher time score)
      // - It's in the same channel (gets channel boost)
      expect(firstResult.id).toBe('msg1');
      expect(firstResult.metadata.originalScore).toBe(0.95);
      expect(firstResult.metadata.channelScore).toBe(1.2); // Updated channel boost

      // Message 2 should be second despite higher raw score because:
      // - It's older (lower time score)
      // - It's in a different channel (no channel boost)
      expect(secondResult.id).toBe('msg2');
      expect(secondResult.metadata.originalScore).toBe(0.98);
      expect(secondResult.metadata.channelScore).toBe(1); // No channel boost

      // Verify time decay is working
      expect(firstResult.metadata.timeScore).toBeGreaterThan(secondResult.metadata.timeScore);

      // Verify final scores reflect all factors
      expect(firstResult.score).toBeGreaterThan(secondResult.score);
    });

    it('should boost scores for messages in the same thread', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const threadMessages = [
        {
          id: 'msg1',
          score: 0.8,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            channelId: 'channel1',
            content: 'First message',
            timestamp: new Date().toISOString(),
            chunkIndex: 0,
            totalChunks: 1
          }
        },
        {
          id: 'msg2',
          score: 0.7,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg2',
            channelId: 'channel1',
            content: 'Reply message',
            replyTo: 'msg1',
            timestamp: new Date().toISOString(),
            chunkIndex: 0,
            totalChunks: 1
          }
        }
      ];

      // Mock Pinecone response with thread messages
      const mockResults = {
        matches: threadMessages,
        namespace: ''
      };
      pineconeService.queryVectors.mockResolvedValue(mockResults);

      const result = await service.findSimilarMessages('test query', {
        channelId: 'channel1'
      });

      // Verify thread boost was applied
      expect(result.messages.length).toBe(2);
      const firstMessage = result.messages[0];
      const secondMessage = result.messages[1];
      
      expect(firstMessage.id).toBe('msg1');
      expect(firstMessage.score).toBeGreaterThan(0.8);
      expect(secondMessage.id).toBe('msg2');
      expect(secondMessage.score).toBeGreaterThan(0.7); // Should be boosted

      // Verify message metadata
      expect(firstMessage.metadata.originalScore).toBe(0.95);
      expect(firstMessage.metadata.channelScore).toBe(1.2);
    });
  });

  describe('storeMessageBatch', () => {
    it('should store multiple messages in batches', async () => {
      const mockChunks = [
        {
          content: 'Test content 1',
          metadata: {
            messageId: 'msg1',
            chunkIndex: 0,
            totalChunks: 2,
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString(),
            content: 'Test content 1'
          }
        },
        {
          content: 'Test content 2',
          metadata: {
            messageId: 'msg1',
            chunkIndex: 1,
            totalChunks: 2,
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString(),
            content: 'Test content 2'
          }
        }
      ];

      // Update other mock chunks
      const mockChunk = {
        content: 'Test content',
        metadata: {
          messageId: 'msg1',
          chunkIndex: 0,
          totalChunks: 1,
          channelId: 'channel1',
          userId: 'user1',
          timestamp: new Date().toISOString(),
          content: 'Test content'
        }
      };

      jest.spyOn(textChunkingService, 'chunkText')
        .mockReturnValue([mockChunk])
        .mockReturnValueOnce([mockChunk]);

      // Mock embedding service
      const mockEmbedding = [0.1, 0.2, 0.3];
      jest.spyOn(embeddingService, 'createEmbedding').mockResolvedValue(mockEmbedding);

      // Mock pinecone service
      jest.spyOn(pineconeService, 'upsertVectors').mockResolvedValue();

      const results = await service.storeMessageBatch([
        {
          id: 'msg1',
          content: 'Test message 1',
          metadata: {
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        },
        {
          id: 'msg2',
          content: 'Test message 2',
          metadata: {
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        }
      ]);
      
      expect(results).toHaveLength(2);
      expect(results[0].messageId).toBe('msg1');
      expect(results[0].success).toBe(true);
      expect(results[1].messageId).toBe('msg2');
      expect(results[1].success).toBe(true);

      // Verify vectors were stored in batch
      const expectedVectors = [
        {
          id: `msg1_chunk_0`,
          values: mockEmbedding,
          metadata: mockChunks[0].metadata
        },
        {
          id: `msg2_chunk_0`,
          values: mockEmbedding,
          metadata: mockChunks[1].metadata
        }
      ];

      // Get the actual vectors that were passed to upsertVectors
      const actualVectors = pineconeService.upsertVectors.mock.calls[0][0];
      
      // Sort both arrays by id for comparison
      const sortById = (a: any, b: any) => a.id.localeCompare(b.id);
      expect(actualVectors.sort(sortById)).toEqual(expectedVectors.sort(sortById));
    });

    it('should handle empty batch', async () => {
      const results = await service.storeMessageBatch([]);
      expect(results).toHaveLength(0);
    });

    it('should validate channelId in metadata', async () => {
      const messages: MessageBatch[] = [{
        id: 'msg1',
        content: 'Test message',
        metadata: {
          userId: 'user1',
          timestamp: new Date().toISOString(),
          channelId: undefined // This will fail the validation but satisfy the type
        }
      }];

      await expect(service.storeMessageBatch(messages)).rejects.toThrow('All messages must have channelId in metadata');
    });

    it('should handle failures gracefully', async () => {
      // Mock embedding service to fail
      jest.spyOn(embeddingService, 'createEmbedding').mockRejectedValueOnce(new Error('Embedding failed'));

      const messages = [{
        id: 'msg1',
        content: 'Test message',
        metadata: {
          channelId: 'channel1',
          userId: 'user1',
          timestamp: new Date().toISOString()
        }
      }];

      const results = await service.storeMessageBatch(messages);
      
      expect(results).toHaveLength(1);
      expect(results[0].messageId).toBe('msg1');
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });
}); 