import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from '../modules/search/services/search.service';
import { VectorStoreService, SearchResult } from '../lib/vector-store.service';
import { ResponseSynthesisService } from '../lib/response-synthesis.service';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: VectorStoreService,
          useValue: {
            findSimilarMessages: jest.fn().mockResolvedValue({
              messages: [],
              total: 0,
              hasMore: false
            })
          }
        },
        {
          provide: ResponseSynthesisService,
          useValue: {
            synthesizeResponse: jest.fn().mockResolvedValue({
              response: 'test response'
            })
          }
        }
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('semanticSearch', () => {
    it('should return search results', async () => {
      const result = await service.semanticSearch({
        query: 'test query',
        userId: 'test-user'
      });

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.metadata.totalMatches).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe('channelSearch', () => {
    it('should return channel search results', async () => {
      const result = await service.channelSearch('channel1', {
        query: 'test query',
        userId: 'test-user'
      });

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.metadata.totalMatches).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe('userSearch', () => {
    it('should return user search results', async () => {
      const result = await service.userSearch('user1', {
        query: 'test query',
        userId: 'test-user'
      });

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.metadata.totalMatches).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe('ragSearch', () => {
    it('should return RAG search results', async () => {
      const result = await service.ragSearch({
        query: 'test query',
        channelId: 'channel1',
        userId: 'test-user'
      });

      expect(result).toBeDefined();
      expect(result.response).toBe('test response');
      expect(result.contextMessageCount).toBe(0);
    });
  });
}); 