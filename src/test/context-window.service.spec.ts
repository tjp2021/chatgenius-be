import { Test, TestingModule } from '@nestjs/testing';
import { ContextWindowService } from '../lib/context-window.service';
import { VectorStoreService, SearchResult } from '../lib/vector-store.service';
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
      score: 0.9
    }],
    total: 1,
    hasMore: false
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextWindowService,
        {
          provide: VectorStoreService,
          useValue: {
            findSimilarMessages: jest.fn().mockResolvedValue(mockSearchResult)
          }
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