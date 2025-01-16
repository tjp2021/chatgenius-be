import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

describe('AiService - Document Content Extraction', () => {
  let aiService: AiService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    file: {
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
  });

  it('should throw BadRequestException when file not found', async () => {
    mockPrismaService.file.findUnique.mockResolvedValue(null);
    
    await expect(aiService.extractDocumentContent('non-existent-file-id'))
      .rejects
      .toThrow(BadRequestException);
  });

  it('should successfully extract text from markdown file', async () => {
    const testFilePath = path.join(__dirname, 'fixtures', 'canelo-analysis.md');
    const fileContent = fs.readFileSync(testFilePath, 'utf8');
    
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: 'test-file-id',
      type: 'text/markdown',
      url: testFilePath
    });

    const result = await aiService.extractDocumentContent('test-file-id');
    
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain(fileContent.substring(0, 100)); // Check first 100 chars match
  });
}); 