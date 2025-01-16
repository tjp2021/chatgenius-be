import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { VectorStoreService } from '../lib/vector-store.service';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';

describe('AiService - Document Content Extraction', () => {
  let aiService: AiService;
  let prismaService: PrismaService;
  let vectorStore: VectorStoreService;

  const mockPrismaService = {
    file: {
      findUnique: jest.fn()
    }
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('fake-api-key')
  };

  const mockVectorStore = {
    storeMessage: jest.fn(),
    searchMessages: jest.fn()
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
        },
        {
          provide: VectorStoreService,
          useValue: mockVectorStore
        }
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
    prismaService = module.get<PrismaService>(PrismaService);
    vectorStore = module.get<VectorStoreService>(VectorStoreService);

    // Clear all mocks before each test
    jest.clearAllMocks();
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

  it('should throw BadRequestException for unsupported file types', async () => {
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: 'test-file-id',
      type: 'image/jpeg',
      url: 'test-url'
    });
    
    await expect(aiService.extractDocumentContent('test-file-id'))
      .rejects
      .toThrow(BadRequestException);
  });

  it('should extract content from different markdown files', async () => {
    const testFiles = [
      'canelo-analysis.md',
      'sanchez-analysis.md',
      'chavez-analysis.md'
    ];

    for (const fileName of testFiles) {
      const testFilePath = path.join(__dirname, 'fixtures', fileName);
      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      
      mockPrismaService.file.findUnique.mockResolvedValue({
        id: 'test-file-id',
        type: 'text/markdown',
        url: testFilePath
      });

      const result = await aiService.extractDocumentContent('test-file-id');
      
      expect(result).toBe(fileContent);
    }
  });

  it('should extract content from text file', async () => {
    // Setup test file
    const testContent = 'This is a test text file content.\nIt has multiple lines.\nEnd of content.';
    const testFilePath = path.join(__dirname, 'fixtures', 'test.txt');
    
    // Ensure test directory exists
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir);
    }
    
    // Write test content
    fs.writeFileSync(testFilePath, testContent);
    
    // Mock file lookup
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: 'test-file-id',
      type: 'text/plain',
      url: testFilePath
    });

    try {
      // Execute
      const result = await aiService.extractDocumentContent('test-file-id');
      
      // Verify
      expect(result).toBe(testContent);
    } finally {
      // Cleanup
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  it('should extract content from PDF file', async () => {
    const testFilePath = path.join(__dirname, 'fixtures', 'canelo-analysis.pdf');
    
    // Mock file lookup
    mockPrismaService.file.findUnique.mockResolvedValue({
      id: 'test-file-id',
      type: 'application/pdf',
      url: testFilePath,
    });

    // Extract content
    const result = await aiService.extractDocumentContent('test-file-id');
    
    // Verify content
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result.toLowerCase()).toContain('canelo'); // Should contain the boxer's name
  });
}); 