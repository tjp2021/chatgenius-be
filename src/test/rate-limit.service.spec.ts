import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitService } from '../lib/rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let redisMock: any;

  beforeEach(async () => {
    redisMock = {
      incr: jest.fn(),
      expire: jest.fn(),
      quit: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitService],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    // Replace Redis instance with mock
    service['redis'] = redisMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return true when rate limit is exceeded', async () => {
    redisMock.incr.mockResolvedValue(6);  // Over limit of 5
    
    const isLimited = await service.isRateLimited('test-key', 5, 60);
    
    expect(isLimited).toBe(true);
    expect(redisMock.incr).toHaveBeenCalledWith('ratelimit:test-key');
  });

  it('should return false when under rate limit', async () => {
    redisMock.incr.mockResolvedValue(3);  // Under limit of 5
    
    const isLimited = await service.isRateLimited('test-key', 5, 60);
    
    expect(isLimited).toBe(false);
    expect(redisMock.incr).toHaveBeenCalledWith('ratelimit:test-key');
  });

  it('should set expiry on first request', async () => {
    redisMock.incr.mockResolvedValue(1);  // First request
    
    await service.isRateLimited('test-key', 5, 60);
    
    expect(redisMock.expire).toHaveBeenCalledWith('ratelimit:test-key', 60);
  });

  it('should not set expiry on subsequent requests', async () => {
    redisMock.incr.mockResolvedValue(2);  // Not first request
    
    await service.isRateLimited('test-key', 5, 60);
    
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('should fail open on Redis error', async () => {
    redisMock.incr.mockRejectedValue(new Error('Redis connection failed'));
    
    const isLimited = await service.isRateLimited('test-key', 5, 60);
    
    expect(isLimited).toBe(false);
  });
}); 