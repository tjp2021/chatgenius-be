import { Test, TestingModule } from '@nestjs/testing';
import { ResponseSynthesisService } from '../lib/response-synthesis.service';
import { ContextWindowService } from '../lib/context-window.service';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from '../lib/rate-limit.service';

describe('ResponseSynthesisService', () => {
  let service: ResponseSynthesisService;
  let contextWindow: ContextWindowService;
  let rateLimitService: RateLimitService;

  const mockContextWindow = {
    getContextWindow: jest.fn()
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'test-api-key';
      return undefined;
    })
  };

  const mockRateLimitService = {
    isRateLimited: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseSynthesisService,
        {
          provide: ContextWindowService,
          useValue: mockContextWindow
        },
        {
          provide: ConfigService,
          useValue: mockConfigService
        },
        {
          provide: RateLimitService,
          useValue: mockRateLimitService
        }
      ],
    }).compile();

    service = module.get<ResponseSynthesisService>(ResponseSynthesisService);
    contextWindow = module.get<ContextWindowService>(ContextWindowService);
    rateLimitService = module.get<RateLimitService>(RateLimitService);

    // Mock OpenAI chat completions
    const mockCompletion = {
      choices: [{
        message: {
          content: 'Mocked response'
        }
      }]
    };

    service['openai'] = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockCompletion)
        }
      }
    } as any;

    // For testing, override the exponential backoff delay
    service['getRetryDelay'] = (retryCount: number) => 100;

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error when rate limited', async () => {
    mockRateLimitService.isRateLimited.mockResolvedValue(true);
    mockContextWindow.getContextWindow.mockResolvedValue({
      messages: [],
      totalTokens: 0
    });

    await expect(service.synthesizeResponse({
      channelId: 'test-channel',
      prompt: 'Hello!'
    })).rejects.toThrow('Rate limit exceeded');

    expect(mockRateLimitService.isRateLimited).toHaveBeenCalledWith(
      'openai_synthesis',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('should synthesize response when not rate limited', async () => {
    mockRateLimitService.isRateLimited.mockResolvedValue(false);
    mockContextWindow.getContextWindow.mockResolvedValue({
      messages: [],
      totalTokens: 0
    });

    const result = await service.synthesizeResponse({
      channelId: 'test-channel',
      prompt: 'Hello!'
    });

    expect(result.response).toBe('Mocked response');
    expect(result.contextMessageCount).toBe(0);
  });

  it('should retry on API failure', async () => {
    mockRateLimitService.isRateLimited.mockResolvedValue(false);
    mockContextWindow.getContextWindow.mockResolvedValue({
      messages: [],
      totalTokens: 0
    });

    const apiError = new Error('API Error');
    let attempts = 0;
    
    service['openai'].chat.completions.create = jest.fn()
      .mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(apiError);
        }
        return Promise.resolve({
          choices: [{
            message: {
              content: 'Retry success'
            }
          }]
        });
      });

    const result = await service.synthesizeResponse({
      channelId: 'test-channel',
      prompt: 'Hello!'
    });

    expect(attempts).toBe(2);
    expect(result.response).toBe('Retry success');
  });

  it('should fail after max retries', async () => {
    mockRateLimitService.isRateLimited.mockResolvedValue(false);
    mockContextWindow.getContextWindow.mockResolvedValue({
      messages: [],
      totalTokens: 0
    });

    service['openai'].chat.completions.create = jest.fn()
      .mockRejectedValue(new Error('API Error'));

    await expect(service.synthesizeResponse({
      channelId: 'test-channel',
      prompt: 'Hello!'
    })).rejects.toThrow('Failed to generate response after multiple attempts');

    expect(service['openai'].chat.completions.create)
      .toHaveBeenCalledTimes(service['MAX_RETRIES']);
  }, 10000); // Increase timeout for this test
}); 