import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('AiService - Styled Response Generation', () => {
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

    // Mock the OpenAI client
    aiService['openai'] = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked styled response'
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
    
    await expect(aiService.generateStyledResponse('test-user-id', 'test prompt'))
      .rejects
      .toThrow(BadRequestException);
  });

  it('should generate styled response with sufficient message history', async () => {
    const mockMessages = [
      { content: 'Hello team!', createdAt: new Date() },
      { content: 'What do you think about this approach?', createdAt: new Date() },
      { content: 'I agree with that solution.', createdAt: new Date() },
      { content: 'Let\'s schedule a meeting to discuss.', createdAt: new Date() },
      { content: 'Great progress everyone!', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

    const result = await aiService.generateStyledResponse('test-user-id', 'How should we proceed?');

    expect(result).toHaveProperty('userId', 'test-user-id');
    expect(result).toHaveProperty('prompt', 'How should we proceed?');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('messageCount', 5);
    expect(typeof result.response).toBe('string');
  });

  it('should validate prompt is not empty', async () => {
    const mockMessages = [
      { content: 'Message 1', createdAt: new Date() },
      { content: 'Message 2', createdAt: new Date() },
      { content: 'Message 3', createdAt: new Date() },
      { content: 'Message 4', createdAt: new Date() },
      { content: 'Message 5', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

    await expect(aiService.generateStyledResponse('test-user-id', ''))
      .rejects
      .toThrow(BadRequestException);
  });
}); 