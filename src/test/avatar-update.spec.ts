import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

describe('AiService - Avatar Update', () => {
  let aiService: AiService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    message: {
      findMany: jest.fn()
    },
    userAvatar: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
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
          useValue: {
            get: jest.fn().mockReturnValue('fake-api-key')
          }
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
                  content: 'Updated style analysis'
                }
              }
            ]
          })
        }
      }
    } as any;
  });

  it('should update avatar with new analysis', async () => {
    // Mock existing avatar
    mockPrismaService.userAvatar.findUnique.mockResolvedValue({
      id: 'test-avatar-id',
      userId: 'test-user-id',
      analysis: JSON.stringify({
        messageAnalysis: {
          timestamp: new Date(),
          lastMessageId: '1',
          analysis: 'Old analysis'
        }
      })
    });

    // Mock messages for style analysis
    mockPrismaService.message.findMany.mockResolvedValue([
      { id: '1', content: 'Test message', createdAt: new Date() },
      { id: '2', content: 'Another message', createdAt: new Date() },
      { id: '3', content: 'Third message', createdAt: new Date() },
      { id: '4', content: 'Fourth message', createdAt: new Date() },
      { id: '5', content: 'Fifth message', createdAt: new Date() }
    ]);

    // Mock avatar update
    mockPrismaService.userAvatar.update.mockResolvedValue({
      id: 'test-avatar-id',
      userId: 'test-user-id',
      analysis: JSON.stringify({
        messageAnalysis: {
          timestamp: new Date(),
          lastMessageId: '1',
          analysis: 'Updated style analysis'
        }
      }),
      updatedAt: new Date()
    });

    const result = await aiService.updateUserAvatar('test-user-id');

    expect(result).toBeDefined();
    expect(result.id).toBe('test-avatar-id');
    expect(result.userId).toBe('test-user-id');
    expect(result.messageAnalysis.analysis).toBe('Updated style analysis');
  });

  it('should throw NotFoundException when avatar does not exist', async () => {
    mockPrismaService.userAvatar.findUnique.mockResolvedValue(null);

    await expect(aiService.updateUserAvatar('non-existent-user'))
      .rejects
      .toThrow(NotFoundException);
  });
}); 