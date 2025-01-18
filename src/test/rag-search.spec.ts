import { Test, TestingModule } from '@nestjs/testing';
import { VectorStoreService } from '../lib/vector-store.service';
import { SearchResult } from '../lib/vector-store.service';

describe('RAG Search', () => {
  let service: VectorStoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VectorStoreService],
    }).compile();

    service = module.get<VectorStoreService>(VectorStoreService);
  });

  it('should return search results', async () => {
    const results = await service.findSimilarMessages('test query');
    expect(results.total).toBeGreaterThan(0);
    expect(results.messages.some(msg => msg.id === 'msg1' || msg.id === 'msg2')).toBeTruthy();
  });

  it('should filter by channel', async () => {
    const results = await service.findSimilarMessages('test query', { channelId: 'channel1' });
    expect(results.total).toBe(1);
  });
}); 