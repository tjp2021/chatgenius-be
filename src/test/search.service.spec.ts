import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from '../modules/search/services/search.service';
import { VectorStoreService, SearchResult } from '../lib/vector-store.service';
import { ResponseSynthesisService } from '../lib/response-synthesis.service';

describe('SearchService', () => {
  let service: SearchService;
  let vectorStore: VectorStoreService;
  let responseSynthesis: ResponseSynthesisService;

  const mockSearchResult: SearchResult = {
    messages: [{
      id: 'msg1',
      content: 'test content',
      metadata: {
        userId: 'user1',
        userName: 'Test User',
        timestamp: new Date().toISOString(),
        channelId: 'channel1'
      },
      score: 0.9
    }],
    total: 1,
    hasMore: false
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: VectorStoreService,
          useValue: {
            findSimilarMessages: jest.fn().mockResolvedValue(mockSearchResult)
          }
        },
        {
          provide: ResponseSynthesisService,
          useValue: {
            synthesizeResponse: jest.fn().mockResolvedValue({ response: 'Test response', contextMessageCount: 1 })
          }
        }
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    vectorStore = module.get<VectorStoreService>(VectorStoreService);
    responseSynthesis = module.get<ResponseSynthesisService>(ResponseSynthesisService);
  });

  describe('semanticSearch', () => {
    it('should return search results', async () => {
      const result = await service.semanticSearch({
        query: 'test query'
      });

      expect(vectorStore.findSimilarMessages).toHaveBeenCalled();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('channelSearch', () => {
    it('should return channel search results', async () => {
      const result = await service.channelSearch('channel1', {
        query: 'test query'
      });

      expect(vectorStore.findSimilarMessages).toHaveBeenCalled();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('userSearch', () => {
    it('should return user search results', async () => {
      const result = await service.userSearch('user1', {
        query: 'test query'
      });

      expect(vectorStore.findSimilarMessages).toHaveBeenCalled();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('ragSearch', () => {
    it('should return RAG search results', async () => {
      const result = await service.ragSearch({
        query: 'test query',
        channelId: 'channel1'
      });

      expect(vectorStore.findSimilarMessages).toHaveBeenCalled();
      expect(responseSynthesis.synthesizeResponse).toHaveBeenCalled();
      expect(result.response).toBeDefined();
    });
  });
}); 