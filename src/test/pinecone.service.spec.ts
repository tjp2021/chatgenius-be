import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PineconeService } from '../lib/pinecone.service';

describe('PineconeService', () => {
  let service: PineconeService;

  const mockConfigService = {
    get: jest.fn((key) => {
      switch (key) {
        case 'PINECONE_API_KEY':
          return 'test-api-key';
        case 'PINECONE_ENVIRONMENT':
          return 'aped-4627-b74a';
        case 'PINECONE_INDEX_NAME':
          return 'chatgenius-1536';
        case 'PINECONE_PROJECT_ID':
          return 'o872918';
      }
    })
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PineconeService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ],
    }).compile();

    service = module.get<PineconeService>(PineconeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsertVector', () => {
    it('should upsert vector successfully', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({});
      const mockIndex = { upsert: mockUpsert };
      jest.spyOn(service['pinecone'], 'Index').mockReturnValue(mockIndex as any);

      await service.upsertVector('test-id', [0.1, 0.2, 0.3], { 
        content: 'test content'
      });

      expect(mockUpsert).toHaveBeenCalledWith([{
        id: 'test-id',
        values: [0.1, 0.2, 0.3],
        metadata: { content: 'test content' }
      }]);
    });
  });

  describe('queryVectors', () => {
    it('should query vectors with default topK', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        matches: [
          { id: 'test-id', score: 0.9, metadata: { content: 'test' } }
        ]
      });
      const mockIndex = { query: mockQuery };
      jest.spyOn(service['pinecone'], 'Index').mockReturnValue(mockIndex as any);

      const result = await service.queryVectors([0.1, 0.2, 0.3]);

      expect(mockQuery).toHaveBeenCalledWith({
        vector: [0.1, 0.2, 0.3],
        topK: 5,
        includeMetadata: true
      });
    });
  });
}); 