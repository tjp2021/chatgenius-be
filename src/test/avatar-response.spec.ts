import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('AiService - Avatar Response Generation', () => {
  let aiService: AiService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userAvatar: {
      findUnique: jest.fn()
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
                  content: 'Mocked avatar response'
                }
              }
            ]
          })
        }
      }
    } as any;
  });

  it('should generate response using avatar style', async () => {
    mockPrismaService.userAvatar.findUnique.mockResolvedValue({
      id: 'test-avatar-id',
      userId: 'test-user-id',
      analysis: JSON.stringify({
        messageAnalysis: {
          timestamp: new Date(),
          lastMessageId: '1',
          analysis: 'User has a formal, technical writing style'
        }
      }),
      updatedAt: new Date()
    });

    const result = await aiService.generateAvatarResponse('test-user-id', 'Hello!');
    
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should throw error when avatar not found', async () => {
    mockPrismaService.userAvatar.findUnique.mockResolvedValue(null);

    await expect(aiService.generateAvatarResponse('test-user-id', 'Hello!'))
      .rejects
      .toThrow(BadRequestException);
  });

  it('should handle empty prompt', async () => {
    await expect(aiService.generateAvatarResponse('test-user-id', ''))
      .rejects
      .toThrow(BadRequestException);
  });

  it('should handle very long prompts', async () => {
    const longPrompt = 'a'.repeat(5000);
    mockPrismaService.userAvatar.findUnique.mockResolvedValue({
      id: 'test-avatar-id',
      userId: 'test-user-id',
      analysis: JSON.stringify({
        messageAnalysis: {
          timestamp: new Date(),
          lastMessageId: '1',
          analysis: 'User style'
        }
      }),
      updatedAt: new Date()
    });

    const result = await aiService.generateAvatarResponse('test-user-id', longPrompt);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle corrupted avatar analysis data', async () => {
    mockPrismaService.userAvatar.findUnique.mockResolvedValue({
      id: 'test-avatar-id',
      userId: 'test-user-id',
      analysis: 'invalid-json',
      updatedAt: new Date()
    });
    
    await expect(aiService.generateAvatarResponse('test-user-id', 'Hello!'))
      .rejects
      .toThrow();
  });
}); 