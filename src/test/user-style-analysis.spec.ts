import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('AiService - User Style Analysis', () => {
  let aiService: AiService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    message: {
      findMany: jest.fn()
    }
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('fake-api-key')
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Mock the OpenAI client directly on the service
    aiService['openai'] = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked style analysis response'
                }
              }
            ]
          })
        }
      }
    } as any;
  });

  it('should throw BadRequestException when user has insufficient messages', async () => {
    mockPrismaService.message.findMany.mockResolvedValue([]);
    
    await expect(aiService.analyzeUserStyle('test-user-id'))
      .rejects
      .toThrow(BadRequestException);
  });

  it('should analyze user style with sufficient message history', async () => {
    // Mock messages for a user
    const mockMessages = [
      { content: 'Hello team!', createdAt: new Date() },
      { content: 'What do you think about this approach?', createdAt: new Date() },
      { content: 'I agree with that solution.', createdAt: new Date() },
      { content: 'Let\'s schedule a meeting to discuss.', createdAt: new Date() },
      { content: 'Great progress everyone!', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

    const result = await aiService.analyzeUserStyle('test-user-id');

    expect(result).toHaveProperty('userId', 'test-user-id');
    expect(result).toHaveProperty('messageCount', 5);
    expect(result).toHaveProperty('styleAnalysis');
    expect(typeof result.styleAnalysis).toBe('string');
  });
}); 