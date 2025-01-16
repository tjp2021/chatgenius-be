import { Test, TestingModule } from '@nestjs/testing';
import { VectorStoreService } from '../lib/vector-store.service';
import { PineconeService } from '../lib/pinecone.service';
import { EmbeddingService } from '../lib/embedding.service';

describe('VectorStoreService', () => {
  let service: VectorStoreService;
  let pineconeService: PineconeService;
  let embeddingService: EmbeddingService;

  const mockEmbedding = Array(1536).fill(0.1);
  const mockPineconeResponse = {
    matches: [
      { 
        id: 'msg1', 
        score: 0.9, 
        metadata: { content: 'test content', userId: 'user1', timestamp: new Date().toISOString() },
        values: []
      }
    ],
    namespace: ''
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorStoreService,
        {
          provide: PineconeService,
          useValue: {
            upsertVector: jest.fn().mockResolvedValue(undefined),
            upsertVectors: jest.fn().mockResolvedValue(undefined),
            queryVectors: jest.fn().mockResolvedValue(mockPineconeResponse),
            getVectorById: jest.fn().mockImplementation((id) => {
              if (id === 'parent-msg') {
                return Promise.resolve({
                  id: 'parent-msg',
                  score: 0.8,
                  metadata: {
                    content: 'parent content',
                    userId: 'user1',
                    timestamp: new Date().toISOString()
                  }
                });
              }
              return Promise.resolve(undefined);
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

    service = module.get<VectorStoreService>(VectorStoreService);
    pineconeService = module.get<PineconeService>(PineconeService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  describe('storeMessage', () => {
    it('should store message with embedding', async () => {
      const messageId = 'test-id';
      const content = 'test content';
      const metadata = { userId: 'user1' };

      await service.storeMessage(messageId, content, metadata);

      expect(embeddingService.createEmbedding).toHaveBeenCalledWith(content);
      expect(pineconeService.upsertVector).toHaveBeenCalledWith(
        messageId,
        mockEmbedding,
        expect.objectContaining({
          userId: 'user1',
          timestamp: expect.any(String)
        })
      );
    });

    it('should handle errors during storage', async () => {
      jest.spyOn(embeddingService, 'createEmbedding').mockRejectedValue(new Error('Embedding failed'));
      
      await expect(service.storeMessage('id', 'content', {}))
        .rejects
        .toThrow('Embedding failed');
    });
  });

  describe('storeMessages', () => {
    it('should store multiple messages in batch', async () => {
      const messages = [
        { id: 'msg1', content: 'content 1', metadata: { userId: 'user1' } },
        { id: 'msg2', content: 'content 2', metadata: { userId: 'user2' } }
      ];

      // Mock embeddings creation
      jest.spyOn(embeddingService, 'createEmbedding')
        .mockResolvedValueOnce([...mockEmbedding])
        .mockResolvedValueOnce([...mockEmbedding]);

      await service.storeMessages(messages);

      // Verify embeddings were created for each message
      expect(embeddingService.createEmbedding).toHaveBeenCalledTimes(2);
      expect(embeddingService.createEmbedding).toHaveBeenCalledWith('content 1');
      expect(embeddingService.createEmbedding).toHaveBeenCalledWith('content 2');

      // Verify batch upsert was called with correct vectors
      expect(pineconeService.upsertVectors).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'msg1',
            values: mockEmbedding,
            metadata: expect.objectContaining({
              userId: 'user1',
              timestamp: expect.any(String)
            })
          }),
          expect.objectContaining({
            id: 'msg2',
            values: mockEmbedding,
            metadata: expect.objectContaining({
              userId: 'user2',
              timestamp: expect.any(String)
            })
          })
        ])
      );
    });

    it('should handle empty batch', async () => {
      await service.storeMessages([]);
      expect(embeddingService.createEmbedding).not.toHaveBeenCalled();
      expect(pineconeService.upsertVectors).not.toHaveBeenCalled();
    });

    it('should handle embedding errors', async () => {
      const messages = [
        { id: 'msg1', content: 'content 1', metadata: { userId: 'user1' } }
      ];

      jest.spyOn(embeddingService, 'createEmbedding')
        .mockRejectedValue(new Error('Embedding failed'));

      await expect(service.storeMessages(messages))
        .rejects
        .toThrow('Embedding failed');
    });
  });

  describe('findSimilarMessages', () => {
    it('should find similar messages', async () => {
      const results = await service.findSimilarMessages('test query');

      expect(embeddingService.createEmbedding).toHaveBeenCalledWith('test query');
      expect(pineconeService.queryVectors).toHaveBeenCalledWith(mockEmbedding, 5);
      expect(results[0]).toMatchObject({
        id: 'msg1',
        score: expect.any(Number),
        metadata: expect.objectContaining({
          content: 'test content',
          userId: 'user1',
          timestamp: expect.any(String)
        })
      });
    });

    it('should handle empty results', async () => {
      jest.spyOn(pineconeService, 'queryVectors').mockResolvedValue({
        matches: [],
        namespace: ''
      });
      
      const results = await service.findSimilarMessages('test query');
      expect(results).toEqual([]);
    });

    it('should retrieve parent message when replyTo is present', async () => {
      // Mock a message with replyTo
      const mockResponseWithReply = {
        matches: [
          { 
            id: 'reply-msg', 
            score: 0.9, 
            metadata: { 
              content: 'reply content',
              userId: 'user1',
              timestamp: new Date().toISOString(),
              replyTo: 'parent-msg'
            },
            values: []
          }
        ],
        namespace: ''
      };

      // Setup mock responses
      const queryVectorsSpy = jest.spyOn(pineconeService, 'queryVectors')
        .mockResolvedValueOnce(mockResponseWithReply);
      const getVectorByIdSpy = jest.spyOn(pineconeService, 'getVectorById');

      const results = await service.findSimilarMessages('test query');

      // Verify the results
      expect(results[0]).toMatchObject({
        id: 'reply-msg',
        metadata: expect.objectContaining({
          content: 'reply content',
          replyTo: 'parent-msg'
        }),
        context: {
          parentMessage: {
            id: 'parent-msg',
            metadata: expect.objectContaining({
              content: 'parent content'
            })
          }
        }
      });

      // Verify parent message was queried
      expect(queryVectorsSpy).toHaveBeenCalledTimes(1);
      expect(getVectorByIdSpy).toHaveBeenCalledWith('parent-msg');
    });
  });
}); 