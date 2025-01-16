import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from '../modules/files/services/files.service';
import { PrismaService } from '../lib/prisma.service';
import { S3Service } from '../modules/files/services/s3.service';
import { TextChunkingService } from '../lib/text-chunking.service';
import { VectorStoreService } from '../lib/vector-store.service';
import { BadRequestException } from '@nestjs/common';

jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer) => {
    return Promise.resolve({ text: 'Mocked PDF content' });
  });
});

describe('FilesService', () => {
  let service: FilesService;
  let prismaService: PrismaService;
  let s3Service: S3Service;
  let textChunkingService: TextChunkingService;
  let vectorStoreService: VectorStoreService;

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockS3Service = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockTextChunkingService = {
    chunkText: jest.fn(),
  };

  const mockVectorStoreService = {
    storeMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: TextChunkingService,
          useValue: mockTextChunkingService,
        },
        {
          provide: VectorStoreService,
          useValue: mockVectorStoreService,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    prismaService = module.get<PrismaService>(PrismaService);
    s3Service = module.get<S3Service>(S3Service);
    textChunkingService = module.get<TextChunkingService>(TextChunkingService);
    vectorStoreService = module.get<VectorStoreService>(VectorStoreService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a file with extracted text content and vectors for PDF', async () => {
      const mockFile: Express.Multer.File = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test content'),
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const mockUserId = 'user123';
      const mockUrl = 'https://test-url.com/test.pdf';
      const mockChunks = [
        {
          content: 'Chunk 1',
          metadata: { chunkIndex: 0, totalChunks: 2 }
        },
        {
          content: 'Chunk 2',
          metadata: { chunkIndex: 1, totalChunks: 2 }
        }
      ];
      
      mockS3Service.uploadFile.mockResolvedValue(mockUrl);
      mockTextChunkingService.chunkText.mockReturnValue(mockChunks);
      mockVectorStoreService.storeMessage.mockResolvedValue(undefined);

      // Mock the file creation response
      const mockVectorIds = [
        `${mockUserId}/test-uuid-test.pdf-chunk-0`,
        `${mockUserId}/test-uuid-test.pdf-chunk-1`
      ];
      mockPrismaService.file.create.mockResolvedValue({
        id: '1',
        name: mockFile.originalname,
        type: mockFile.mimetype,
        size: mockFile.size,
        url: mockUrl,
        textContent: 'Mocked PDF content',
        vectorIds: mockVectorIds,
        userId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(mockFile, mockUserId);

      expect(result.textContent).toBe('Mocked PDF content');
      expect(result.vectorIds).toEqual(expect.arrayContaining([
        expect.stringMatching(/-test\.pdf-chunk-0$/),
        expect.stringMatching(/-test\.pdf-chunk-1$/)
      ]));
      expect(mockTextChunkingService.chunkText).toHaveBeenCalled();
      expect(mockVectorStoreService.storeMessage).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: mockFile.originalname,
          type: mockFile.mimetype,
          size: mockFile.size,
          url: mockUrl,
          textContent: 'Mocked PDF content',
          user: {
            connect: {
              id: mockUserId
            }
          }
        })
      });
    });

    it('should create a file with extracted text content and vectors for text file', async () => {
      const textContent = 'Plain text content';
      const mockFile: Express.Multer.File = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from(textContent),
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const mockUserId = 'user123';
      const mockUrl = 'https://test-url.com/test.txt';
      const mockChunks = [
        {
          content: textContent,
          metadata: { chunkIndex: 0, totalChunks: 1 }
        }
      ];
      
      mockS3Service.uploadFile.mockResolvedValue(mockUrl);
      mockTextChunkingService.chunkText.mockReturnValue(mockChunks);
      mockVectorStoreService.storeMessage.mockResolvedValue(undefined);

      // Mock the file creation response
      const mockVectorIds = [
        `${mockUserId}/test-uuid-test.txt-chunk-0`
      ];
      mockPrismaService.file.create.mockResolvedValue({
        id: '1',
        name: mockFile.originalname,
        type: mockFile.mimetype,
        size: mockFile.size,
        url: mockUrl,
        textContent: textContent,
        vectorIds: mockVectorIds,
        userId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(mockFile, mockUserId);

      expect(result.textContent).toBe(textContent);
      expect(result.vectorIds).toEqual(expect.arrayContaining([
        expect.stringMatching(/-test\.txt-chunk-0$/)
      ]));
      expect(mockTextChunkingService.chunkText).toHaveBeenCalled();
      expect(mockVectorStoreService.storeMessage).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: mockFile.originalname,
          type: mockFile.mimetype,
          size: mockFile.size,
          url: mockUrl,
          textContent: textContent,
          user: {
            connect: {
              id: mockUserId
            }
          }
        })
      });
    });

    it('should create a file without text content or vectors for image', async () => {
      const mockFile: Express.Multer.File = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('image data'),
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const mockUserId = 'user123';
      const mockUrl = 'https://test-url.com/test.jpg';
      
      mockS3Service.uploadFile.mockResolvedValue(mockUrl);
      mockPrismaService.file.create.mockResolvedValue({
        id: '1',
        name: mockFile.originalname,
        type: mockFile.mimetype,
        size: mockFile.size,
        url: mockUrl,
        textContent: null,
        vectorIds: [],
        userId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(mockFile, mockUserId);

      expect(result.textContent).toBeNull();
      expect(result.vectorIds).toEqual([]);
      expect(mockTextChunkingService.chunkText).not.toHaveBeenCalled();
      expect(mockVectorStoreService.storeMessage).not.toHaveBeenCalled();
      expect(mockPrismaService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: mockFile.originalname,
          type: mockFile.mimetype,
          size: mockFile.size,
          url: mockUrl,
          textContent: null,
          vectorIds: undefined,
          user: {
            connect: {
              id: mockUserId
            }
          }
        })
      });
    });
  });
}); 