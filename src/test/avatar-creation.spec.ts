import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('AiService - Avatar Creation', () => {
  let aiService: AiService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    message: {
      findMany: jest.fn()
    },
    userAvatar: {
      create: jest.fn().mockImplementation((data) => ({
        id: 'test-avatar-id',
        userId: data.data.userId,
        analysis: data.data.analysis,
        updatedAt: new Date()
      }))
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

    // Mock OpenAI client
    aiService['openai'] = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked style analysis'
                }
              }
            ]
          })
        }
      }
    } as any;
  });

  it('should create avatar with message analysis', async () => {
    const mockMessages = [
      { id: '1', content: 'Hello!', createdAt: new Date() },
      { id: '2', content: 'How are you?', createdAt: new Date() },
      { id: '3', content: 'Great!', createdAt: new Date() },
      { id: '4', content: 'Thanks!', createdAt: new Date() },
      { id: '5', content: 'Goodbye!', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

    const result = await aiService.createUserAvatar('test-user-id');

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('userId', 'test-user-id');
    expect(result.messageAnalysis).toBeDefined();
    expect(result.messageAnalysis.analysis).toBeDefined();
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('should throw error when user has insufficient messages', async () => {
    mockPrismaService.message.findMany.mockResolvedValue([]);

    await expect(aiService.createUserAvatar('test-user-id'))
      .rejects
      .toThrow(BadRequestException);
  });

  it('should store avatar in database', async () => {
    const mockMessages = [
      { id: '1', content: 'Hello!', createdAt: new Date() },
      { id: '2', content: 'How are you?', createdAt: new Date() },
      { id: '3', content: 'Great!', createdAt: new Date() },
      { id: '4', content: 'Thanks!', createdAt: new Date() },
      { id: '5', content: 'Goodbye!', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
    mockPrismaService.userAvatar.create.mockResolvedValue({
      id: 'test-avatar-id',
      userId: 'test-user-id',
      analysis: JSON.stringify({
        messageAnalysis: {
          timestamp: new Date(),
          lastMessageId: '1',
          analysis: 'Mocked style analysis'
        }
      }),
      updatedAt: new Date()
    });

    const result = await aiService.createUserAvatar('test-user-id');
    
    expect(result.id).toBeDefined();
    expect(mockPrismaService.userAvatar.create).toHaveBeenCalled();
  });

  it('should handle empty message content', async () => {
    const mockMessages = [
      { id: '1', content: '', createdAt: new Date() },
      { id: '2', content: '   ', createdAt: new Date() },
      { id: '3', content: 'Valid message', createdAt: new Date() },
      { id: '4', content: 'Another valid', createdAt: new Date() },
      { id: '5', content: 'Last valid', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
    const result = await aiService.createUserAvatar('test-user-id');
    expect(result).toBeDefined();
  });

  it('should handle very long messages', async () => {
    const mockMessages = [
      { id: '1', content: 'a'.repeat(10000), createdAt: new Date() },
      { id: '2', content: 'Hello', createdAt: new Date() },
      { id: '3', content: 'Normal message', createdAt: new Date() },
      { id: '4', content: 'b'.repeat(5000), createdAt: new Date() },
      { id: '5', content: 'Last message', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
    const result = await aiService.createUserAvatar('test-user-id');
    expect(result).toBeDefined();
    expect(result.messageAnalysis.analysis).toBeDefined();
  });

  it('should handle special characters in messages', async () => {
    const mockMessages = [
      { id: '1', content: '🎉 Special chars: &<>"\'', createdAt: new Date() },
      { id: '2', content: '中文/日本語/한국어', createdAt: new Date() },
      { id: '3', content: 'Line 1\nLine 2\tTabbed', createdAt: new Date() },
      { id: '4', content: 'Regular message', createdAt: new Date() },
      { id: '5', content: '!@#$%^&*()', createdAt: new Date() }
    ];

    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
    const result = await aiService.createUserAvatar('test-user-id');
    expect(result).toBeDefined();
    expect(result.messageAnalysis.analysis).toBeDefined();
  });
}); 