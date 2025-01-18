import { Test, TestingModule } from '@nestjs/testing';
import { ContextWindowService } from '../lib/context-window.service';
import { VectorStoreService } from '../lib/vector-store.service';
import { SearchResult } from '../modules/search/types';
import { jest } from '@jest/globals';

describe('ContextWindowService', () => {
  let service: ContextWindowService;
  let vectorStore: VectorStoreService;

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
      user: {
        id: 'user1',
        name: 'Test User',
        role: 'USER'
      },
      score: 0.9
    }],
    total: 1,
    hasMore: false,
    nextCursor: null
  };

  const mockVectorStore = {
    findSimilarMessages: jest.fn<() => Promise<SearchResult>>().mockResolvedValue(mockSearchResult)
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextWindowService,
        {
          provide: VectorStoreService,
          useValue: mockVectorStore
        }
      ],
    }).compile();

    service = module.get<ContextWindowService>(ContextWindowService);
    vectorStore = module.get<VectorStoreService>(VectorStoreService);
  });

  it('should get context window', async () => {
    const result = await service.getContextWindow({
      channelId: 'channel1',
      prompt: 'test query'
    });

    expect(vectorStore.findSimilarMessages).toHaveBeenCalled();
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
  });
}); 