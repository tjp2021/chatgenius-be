import { Test, TestingModule } from '@nestjs/testing';
import { ContextWindowService } from '../lib/context-window.service';
import { PrismaService } from '../lib/prisma.service';
import { VectorStoreService } from '../lib/vector-store.service';

describe('ContextWindowService', () => {
  let service: ContextWindowService;
  let prismaService: PrismaService;
  let vectorStore: VectorStoreService;

  const mockPrismaService = {
    message: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    }
  };

  const mockVectorStore = {
    findSimilarMessages: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextWindowService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: VectorStoreService,
          useValue: mockVectorStore
        }
      ],
    }).compile();

    service = module.get<ContextWindowService>(ContextWindowService);
    prismaService = module.get<PrismaService>(PrismaService);
    vectorStore = module.get<VectorStoreService>(VectorStoreService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty context for empty channel', async () => {
    mockPrismaService.message.findMany.mockResolvedValue([]);
    mockVectorStore.findSimilarMessages.mockResolvedValue([]);

    const result = await service.getContextWindow({
      channelId: 'test-channel',
      prompt: 'test prompt'
    });

    expect(result.messages).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  it('should return relevant messages within token limit', async () => {
    const mockVectorResults = [
      { id: '1', score: 0.9 },
      { id: '2', score: 0.8 }
    ];

    const mockMessages = {
      '1': { content: 'First message', createdAt: new Date() },
      '2': { content: 'Second message', createdAt: new Date() }
    };

    mockVectorStore.findSimilarMessages.mockResolvedValue(mockVectorResults);
    mockPrismaService.message.findUnique.mockImplementation(async ({ where }) => 
      mockMessages[where.id]
    );

    const result = await service.getContextWindow({
      channelId: 'test-channel',
      prompt: 'test prompt',
      maxTokens: 1000
    });

    expect(result.messages).toHaveLength(2);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThanOrEqual(1000);
    expect(mockPrismaService.message.findUnique).toHaveBeenCalledTimes(2);
  });

  it('should respect token limit and not include messages that would exceed it', async () => {
    const mockVectorResults = [
      { id: '1', score: 0.9 },
      { id: '2', score: 0.8 }
    ];

    const mockMessages = {
      '1': { content: 'A'.repeat(100), createdAt: new Date() }, // ~25 tokens
      '2': { content: 'B'.repeat(100), createdAt: new Date() }  // ~25 tokens
    };

    mockVectorStore.findSimilarMessages.mockResolvedValue(mockVectorResults);
    mockPrismaService.message.findUnique.mockImplementation(async ({ where }) => 
      mockMessages[where.id]
    );

    const result = await service.getContextWindow({
      channelId: 'test-channel',
      prompt: 'test prompt',
      maxTokens: 30 // Only enough for one message
    });

    expect(result.messages).toHaveLength(1);
    expect(result.totalTokens).toBeLessThanOrEqual(30);
    expect(result.messages[0].id).toBe('1'); // Should include highest scoring message
  });

  it('should handle missing messages gracefully', async () => {
    const mockVectorResults = [
      { id: '1', score: 0.9 },
      { id: '2', score: 0.8 }
    ];

    // Only one message exists in database
    const mockMessages = {
      '1': { content: 'First message', createdAt: new Date() }
    };

    mockVectorStore.findSimilarMessages.mockResolvedValue(mockVectorResults);
    mockPrismaService.message.findUnique.mockImplementation(async ({ where }) => 
      mockMessages[where.id] || null
    );

    const result = await service.getContextWindow({
      channelId: 'test-channel',
      prompt: 'test prompt'
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe('1');
    expect(mockPrismaService.message.findUnique).toHaveBeenCalledTimes(2);
  });

  it('should preserve message order based on score', async () => {
    const mockVectorResults = [
      { id: '2', score: 0.95 }, // Higher score but different order
      { id: '1', score: 0.9 },
      { id: '3', score: 0.8 }
    ];

    const mockMessages = {
      '1': { content: 'First', createdAt: new Date() },
      '2': { content: 'Second', createdAt: new Date() },
      '3': { content: 'Third', createdAt: new Date() }
    };

    mockVectorStore.findSimilarMessages.mockResolvedValue(mockVectorResults);
    mockPrismaService.message.findUnique.mockImplementation(async ({ where }) => 
      mockMessages[where.id]
    );

    const result = await service.getContextWindow({
      channelId: 'test-channel',
      prompt: 'test prompt'
    });

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].id).toBe('2'); // Highest score should be first
    expect(result.messages[1].id).toBe('1');
    expect(result.messages[2].id).toBe('3');
  });

  it('should handle vector store errors gracefully', async () => {
    // Simulate vector store error
    mockVectorStore.findSimilarMessages.mockRejectedValue(new Error('Vector store error'));

    const result = await service.getContextWindow({
      channelId: 'test-channel',
      prompt: 'test prompt'
    });

    // Should return empty context on error
    expect(result.messages).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
    expect(mockPrismaService.message.findUnique).not.toHaveBeenCalled();
  });
}); 