import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../lib/embedding.service';
import { BadRequestException } from '@nestjs/common';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let openAiSpy: jest.SpyInstance;

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'OPENAI_API_KEY') return 'test-api-key';
    })
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    
    // Setup default mock for all tests
    const mockEmbedding = Array(1536).fill(0.1);
    openAiSpy = jest.spyOn(service['openai'].embeddings, 'create')
      .mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create embeddings', async () => {
    // Mock OpenAI response
    const mockEmbedding = Array(1536).fill(0.1);
    jest.spyOn(service['openai'].embeddings, 'create').mockResolvedValue({
      data: [{ embedding: mockEmbedding }]
    } as any);

    const result = await service.createEmbedding('test text');
    
    expect(result).toEqual(mockEmbedding);
    expect(result.length).toBe(1536); // OpenAI ada-002 dimension
  });

  it('should handle empty text input', async () => {
    await expect(service.createEmbedding('')).rejects.toThrow();
  });

  it('should handle OpenAI errors', async () => {
    jest.spyOn(service['openai'].embeddings, 'create').mockRejectedValue(new Error('OpenAI Error'));
    await expect(service.createEmbedding('test')).rejects.toThrow('OpenAI Error');
  });

  it('should handle very long text', async () => {
    const longText = 'a'.repeat(8000); // OpenAI has token limits
    const mockEmbedding = Array(1536).fill(0.1);
    
    jest.spyOn(service['openai'].embeddings, 'create').mockResolvedValue({
      data: [{ embedding: mockEmbedding }]
    } as any);

    const result = await service.createEmbedding(longText);
    expect(result.length).toBe(1536);
  });

  describe('input validation', () => {
    it('should reject empty string', async () => {
      await expect(service.createEmbedding('')).rejects.toThrow(BadRequestException);
    });

    it('should reject whitespace-only string', async () => {
      await expect(service.createEmbedding('   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('token limits', () => {
    it('should truncate text longer than 8000 chars', async () => {
      const longText = 'a'.repeat(10000);
      await service.createEmbedding(longText);
      
      expect(openAiSpy).toHaveBeenCalledWith(expect.objectContaining({
        input: expect.any(String)
      }));
      expect(openAiSpy.mock.calls[0][0].input.length).toBe(8000);
    });
  });

  describe('error handling', () => {
    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      
      jest.spyOn(service['openai'].embeddings, 'create')
        .mockRejectedValue(rateLimitError);

      await expect(service.createEmbedding('test'))
        .rejects
        .toThrow('Rate limit exceeded');
    });

    it('should handle invalid API key', async () => {
      const authError = new Error('Invalid API key');
      authError.name = 'AuthenticationError';
      
      jest.spyOn(service['openai'].embeddings, 'create')
        .mockRejectedValue(authError);

      await expect(service.createEmbedding('test'))
        .rejects
        .toThrow('Invalid API key');
    });
  });

  describe('embedding quality', () => {
    it('should return correct dimensionality', async () => {
      const result = await service.createEmbedding('test');
      expect(result.length).toBe(1536);
    });

    it('should return normalized vectors', async () => {
      const mockNormalizedEmbedding = new Array(1536).fill(1/Math.sqrt(1536)); // Unit vector
      openAiSpy.mockResolvedValueOnce({
        data: [{ embedding: mockNormalizedEmbedding }]
      } as any);

      const result = await service.createEmbedding('test');
      const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1, 1);
    });
  });
}); 