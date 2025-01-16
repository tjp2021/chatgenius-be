import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('AiService - Message Search', () => {
  let aiService: AiService;
  let prismaService: PrismaService;

  const mockMessages = [
    { id: '1', content: 'Hello world', userId: 'user1', channelId: 'channel1', createdAt: new Date() },
    { id: '2', content: 'Testing search', userId: 'user1', channelId: 'channel1', createdAt: new Date() }
  ];

  const mockPrismaService = {
    message: {
      findMany: jest.fn().mockResolvedValue(mockMessages)
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
  });

  it('should search user messages', async () => {
    const result = await aiService.searchMessages('hello', { userId: 'user1' });
    expect(result).toEqual(mockMessages);
    expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user1',
          content: { contains: 'hello', mode: 'insensitive' }
        })
      })
    );
  });

  it('should respect limit option', async () => {
    await aiService.searchMessages('test', { userId: 'user1', limit: 10 });
    expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10
      })
    );
  });

  it('should filter by date range', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-15');
    
    await aiService.searchMessages('test', { 
      userId: 'user1',
      startDate, 
      endDate 
    });
    expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user1',
          createdAt: { gte: startDate, lte: endDate }
        })
      })
    );
  });
}); 