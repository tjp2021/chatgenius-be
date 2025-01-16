import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('AiService - User Style Analysis', () => {
  let aiService: AiService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        PrismaService,
        ConfigService,
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should analyze user style with sufficient message history', async () => {
    // Get a real user ID from our seeded data
    const user = await prismaService.user.findFirst();
    if (!user) {
      throw new Error('No test user found in database');
    }

    const result = await aiService.analyzeUserStyle(user.id);

    // Verify the structure of the response
    expect(result).toHaveProperty('userId', user.id);
    expect(result).toHaveProperty('messageCount');
    expect(result).toHaveProperty('styleAnalysis');
    expect(typeof result.styleAnalysis).toBe('string');
    expect(result.messageCount).toBeGreaterThanOrEqual(5);
  });

  it('should throw BadRequestException when user has insufficient messages', async () => {
    // Use a non-existent user ID
    const nonExistentUserId = 'non-existent-user-id';

    await expect(aiService.analyzeUserStyle(nonExistentUserId))
      .rejects
      .toThrow(BadRequestException);
  });
}); 