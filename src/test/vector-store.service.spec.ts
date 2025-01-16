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
        { content: 'chunk1', metadata: { ...metadata, messageId, chunkIndex: 0, totalChunks: 2 } },
        { content: 'chunk2', metadata: { ...metadata, messageId, chunkIndex: 1, totalChunks: 2 } }
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
    it('should find and reconstruct chunked messages', async () => {
      const searchQuery = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      
      // Mock the embedding service
      embeddingService.createEmbedding.mockResolvedValue(mockEmbedding);

      // Mock Pinecone response with chunks
      const mockChunks = [
        {
          id: 'msg1_chunk_0',
          score: 0.9,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 0,
            totalChunks: 2,
            content: 'This is the first',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        },
        {
          id: 'msg1_chunk_1',
          score: 0.85,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 1,
            totalChunks: 2,
            content: 'part of the message',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        }
      ];

      pineconeService.queryVectors.mockResolvedValue({
        matches: mockChunks,
        namespace: ''
      });

      // Mock text chunking reconstruction
      textChunkingService.reconstructText.mockReturnValue('This is the first part of the message');

      const results = await service.findSimilarMessages(searchQuery, {
        channelId: 'channel1',
        topK: 5
      });

      // Verify search was performed with increased topK
      expect(pineconeService.queryVectors).toHaveBeenCalledWith(
        mockEmbedding,
        15, // topK * 3
        expect.any(Object)
      );

      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'msg1',
        content: 'This is the first part of the message',
        score: expect.any(Number),
        metadata: expect.objectContaining({
          channelId: 'channel1',
          originalScore: 0.9 // Should use max score from chunks
        })
      });

      // Verify text reconstruction was called with chunks
      expect(textChunkingService.reconstructText).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: 'This is the first',
            metadata: expect.objectContaining({
              chunkIndex: 0
            })
          }),
          expect.objectContaining({
            content: 'part of the message',
            metadata: expect.objectContaining({
              chunkIndex: 1
            })
          })
        ])
      );
    });

    it('should handle incomplete or malformed chunks gracefully', async () => {
      const searchQuery = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      
      embeddingService.createEmbedding.mockResolvedValue(mockEmbedding);

      // Mock chunks with missing middle chunk and malformed metadata
      const mockChunks = [
        {
          id: 'msg1_chunk_0',
          score: 0.9,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 0,
            totalChunks: 3,  // Total of 3 chunks but middle one missing
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
        },
        {
          id: 'msg2_chunk_0',
          score: 0.95,
          values: mockEmbedding,
          metadata: {
            // Missing messageId
            chunkIndex: 0,
            totalChunks: 1,
            content: 'Complete single chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        }
      ];

      pineconeService.queryVectors.mockResolvedValue({
        matches: mockChunks,
        namespace: ''
      });

      textChunkingService.reconstructText.mockReturnValue('First part Third part');

      const results = await service.findSimilarMessages(searchQuery, {
        channelId: 'channel1',
        topK: 5
      });

      // Should still return both messages
      expect(results).toHaveLength(2);

      // Check first message (with missing chunk)
      const msg1 = results.find(r => r.id === 'msg1');
      expect(msg1).toBeDefined();
      expect(msg1?.content).toBe('First part Third part');
      expect(msg1?.metadata.originalScore).toBe(0.9); // Should use max score

      // Check second message (with missing messageId)
      const msg2 = results.find(r => r.id === 'msg2_chunk_0');
      expect(msg2).toBeDefined();
      expect(msg2?.content).toBe('Complete single chunk');
      expect(msg2?.metadata.originalScore).toBe(0.95);
    });

    it('should handle out-of-order and duplicate chunks correctly', async () => {
      const searchQuery = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      
      embeddingService.createEmbedding.mockResolvedValue(mockEmbedding);

      // Mock chunks returned in random order with a duplicate
      const mockChunks = [
        {
          id: 'msg1_chunk_2',
          score: 0.88,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 2,
            totalChunks: 3,
            content: 'third chunk',
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
            content: 'first chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        },
        {
          id: 'msg1_chunk_1',
          score: 0.85,
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 1,
            totalChunks: 3,
            content: 'second chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        },
        // Duplicate chunk with different score
        {
          id: 'msg1_chunk_1_dupe',
          score: 0.95, // Higher score than original
          values: mockEmbedding,
          metadata: {
            messageId: 'msg1',
            chunkIndex: 1,
            totalChunks: 3,
            content: 'second chunk',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: new Date().toISOString()
          }
        }
      ];

      pineconeService.queryVectors.mockResolvedValue({
        matches: mockChunks,
        namespace: ''
      });

      // Mock reconstruction to verify chunks are passed in correct order
      textChunkingService.reconstructText.mockImplementation((chunks) => {
        // Verify chunks are ordered by chunkIndex
        const orderedContent = chunks
          .sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex)
          .map(c => c.content)
          .join(' ');
        return orderedContent;
      });

      const results = await service.findSimilarMessages(searchQuery, {
        channelId: 'channel1',
        topK: 5
      });

      // Should combine into single result
      expect(results).toHaveLength(1);
      
      // Should use highest score among all chunks (including duplicate)
      expect(results[0].metadata.originalScore).toBe(0.95);
      
      // Content should be reconstructed in correct order
      expect(results[0].content).toBe('first chunk second chunk third chunk');

      // Verify reconstruction was called with deduplicated chunks in any order
      expect(textChunkingService.reconstructText).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: 'first chunk',
            metadata: expect.objectContaining({ chunkIndex: 0 })
          }),
          expect.objectContaining({
            content: 'second chunk',
            metadata: expect.objectContaining({ chunkIndex: 1 })
          }),
          expect.objectContaining({
            content: 'third chunk',
            metadata: expect.objectContaining({ chunkIndex: 2 })
          })
        ])
      );
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
          score: 0.65,
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
          score: 0.60,
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
        minScore: 0.7
      });

      // Should only return messages with max score above minScore
      expect(results).toHaveLength(2); // msg1 and msg2 only, msg3 filtered out

      // Verify message ordering based on combined scores
      const [firstResult, secondResult] = results;

      // Message 1 should be first despite lower raw score because:
      // - It's more recent (higher time score)
      // - It's in the same channel (gets channel boost)
      expect(firstResult.id).toBe('msg1');
      expect(firstResult.metadata.originalScore).toBe(0.95);
      expect(firstResult.metadata.channelScore).toBe(1.5); // Channel boost applied

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

      pineconeService.queryVectors.mockResolvedValue({
        matches: threadMessages,
        namespace: ''
      });

      const result = await service.findSimilarMessages('test query', {
        channelId: 'channel1'
      });

      // Verify thread boost was applied
      expect(result.length).toBe(2);
      const msg1 = result.find(m => m.id === 'msg1');
      const msg2 = result.find(m => m.id === 'msg2');
      expect(msg1.score).toBeGreaterThan(0.8); // Should be boosted
      expect(msg2.score).toBeGreaterThan(0.7); // Should be boosted
      
      // Verify thread boost is applied correctly
      // The thread boost should be one component of the final score
      expect(msg2.metadata.threadScore).toBe(service['THREAD_BOOST_FACTOR']);
      expect(msg1.metadata.threadScore).toBe(service['THREAD_BOOST_FACTOR']);
    });
  });

  describe('storeMessageBatch', () => {
    it('should store multiple messages in batch successfully', async () => {
      const messages = [
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
      ];

      // Mock chunking service
      const mockChunks = messages.map(msg => ({
        content: msg.content,
        metadata: { ...msg.metadata, messageId: msg.id, chunkIndex: 0, totalChunks: 1 }
      }));
      jest.spyOn(textChunkingService, 'chunkText').mockReturnValue([mockChunks[0]]);
      jest.spyOn(textChunkingService, 'chunkText').mockReturnValueOnce([mockChunks[1]]);

      // Mock embedding service
      const mockEmbedding = [0.1, 0.2, 0.3];
      jest.spyOn(embeddingService, 'createEmbedding').mockResolvedValue(mockEmbedding);

      // Mock pinecone service
      jest.spyOn(pineconeService, 'upsertVectors').mockResolvedValue();

      const results = await service.storeMessageBatch(messages);
      
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