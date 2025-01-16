import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from '../files.service';
import { PrismaService } from '../../../../lib/prisma.service';
import { S3Service } from '../s3.service';
import { BadRequestException } from '@nestjs/common';

describe('FilesService', () => {
  let service: FilesService;
  let prismaService: PrismaService;
  let s3Service: S3Service;

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };

  const mockS3Service = {
    uploadFile: jest.fn(),
    getSignedUrl: jest.fn(),
    deleteFile: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: S3Service,
          useValue: mockS3Service
        }
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    prismaService = module.get<PrismaService>(PrismaService);
    s3Service = module.get<S3Service>(S3Service);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully upload a text file', async () => {
      // Setup
      const mockFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('test content')
      } as Express.Multer.File;

      const userId = 'test-user-id';
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/test.txt';
      
      mockS3Service.uploadFile.mockResolvedValue(mockUrl);
      mockPrismaService.file.create.mockResolvedValue({
        id: 'test-file-id',
        name: mockFile.originalname,
        type: mockFile.mimetype,
        size: mockFile.size,
        url: mockUrl,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Execute
      const result = await service.create(mockFile, userId);

      // Verify
      expect(mockS3Service.uploadFile).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining(userId)
      );
      expect(mockPrismaService.file.create).toHaveBeenCalledWith({
        data: {
          name: mockFile.originalname,
          type: mockFile.mimetype,
          size: mockFile.size,
          url: mockUrl,
          user: {
            connect: {
              id: userId
            }
          }
        }
      });
      expect(result).toMatchObject({
        name: mockFile.originalname,
        type: mockFile.mimetype,
        size: mockFile.size,
        url: mockUrl,
        userId
      });
    });

    it('should reject files with invalid mime types', async () => {
      const mockFile = {
        originalname: 'test.invalid',
        mimetype: 'invalid/type',
        size: 1024,
        buffer: Buffer.from('test content')
      } as Express.Multer.File;

      await expect(service.create(mockFile, 'test-user-id'))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return file with signed URL when found', async () => {
      // Setup
      const fileId = 'test-file-id';
      const mockFile = {
        id: fileId,
        name: 'test.txt',
        type: 'text/plain',
        size: 1024,
        url: 'test-bucket/test.txt',
        userId: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const signedUrl = 'https://test-bucket.s3.amazonaws.com/test.txt?signed=true';

      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockS3Service.getSignedUrl.mockResolvedValue(signedUrl);

      // Execute
      const result = await service.findById(fileId);

      // Verify
      expect(mockPrismaService.file.findUnique).toHaveBeenCalledWith({
        where: { id: fileId }
      });
      expect(mockS3Service.getSignedUrl).toHaveBeenCalled();
      expect(result).toMatchObject({
        ...mockFile,
        url: signedUrl
      });
    });

    it('should return null when file not found', async () => {
      // Setup
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      // Execute
      const result = await service.findById('non-existent-id');

      // Verify
      expect(result).toBeNull();
      expect(mockS3Service.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete file from storage and database', async () => {
      // Setup
      const fileId = 'test-file-id';
      const mockFile = {
        id: fileId,
        url: 'https://test-bucket.s3.amazonaws.com/test-user/test.txt'
      };

      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);

      // Execute
      await service.delete(fileId);

      // Verify
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('test-user/test.txt');
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: fileId }
      });
    });

    it('should do nothing when file not found', async () => {
      // Setup
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      // Execute
      await service.delete('non-existent-id');

      // Verify
      expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
      expect(mockPrismaService.file.delete).not.toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it('should return files with signed URLs for a user', async () => {
      // Setup
      const userId = 'test-user-id';
      const mockFiles = [
        {
          id: 'file-1',
          name: 'test1.txt',
          type: 'text/plain',
          size: 1024,
          url: 'https://test-bucket.s3.amazonaws.com/test-user/test1.txt',
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'file-2',
          name: 'test2.txt',
          type: 'text/plain',
          size: 2048,
          url: 'https://test-bucket.s3.amazonaws.com/test-user/test2.txt',
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const signedUrl1 = 'https://test-bucket.s3.amazonaws.com/test-user/test1.txt?signed=true';
      const signedUrl2 = 'https://test-bucket.s3.amazonaws.com/test-user/test2.txt?signed=true';

      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockS3Service.getSignedUrl
        .mockResolvedValueOnce(signedUrl1)
        .mockResolvedValueOnce(signedUrl2);

      // Execute
      const result = await service.findByUserId(userId);

      // Verify
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: { userId }
      });
      expect(mockS3Service.getSignedUrl).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        ...mockFiles[0],
        url: signedUrl1
      });
      expect(result[1]).toMatchObject({
        ...mockFiles[1],
        url: signedUrl2
      });
    });

    it('should return empty array when user has no files', async () => {
      // Setup
      mockPrismaService.file.findMany.mockResolvedValue([]);

      // Execute
      const result = await service.findByUserId('user-with-no-files');

      // Verify
      expect(result).toEqual([]);
      expect(mockS3Service.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search files with filename filter', async () => {
      // Setup
      const mockFiles = [
        {
          id: 'file-1',
          name: 'test-document.txt',
          type: 'text/plain',
          size: 1024,
          url: 'https://test-bucket.s3.amazonaws.com/test-user/test-document.txt',
          userId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const searchQuery = {
        filename: 'document',
        userId: 'user-1'
      };

      const signedUrl = 'https://test-bucket.s3.amazonaws.com/test-user/test-document.txt?signed=true';
      
      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockPrismaService.file.count.mockResolvedValue(1);
      mockS3Service.getSignedUrl.mockResolvedValue(signedUrl);

      // Execute
      const result = await service.search(searchQuery);

      // Verify
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: {
          name: { contains: searchQuery.filename },
          userId: searchQuery.userId
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      expect(result.items[0]).toMatchObject({
        ...mockFiles[0],
        url: signedUrl
      });
      expect(result.total).toBe(1);
    });

    it('should search files with type filter', async () => {
      // Setup
      const mockFiles = [
        {
          id: 'file-1',
          name: 'test1.txt',
          type: 'text/plain',
          size: 1024,
          url: 'https://test-bucket.s3.amazonaws.com/test-user/test1.txt',
          userId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const searchQuery = {
        type: 'text/plain',
        userId: 'user-1'
      };

      const signedUrl = 'https://test-bucket.s3.amazonaws.com/test-user/test1.txt?signed=true';
      
      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockPrismaService.file.count.mockResolvedValue(1);
      mockS3Service.getSignedUrl.mockResolvedValue(signedUrl);

      // Execute
      const result = await service.search(searchQuery);

      // Verify
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: {
          type: searchQuery.type,
          userId: searchQuery.userId
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      expect(result.items[0]).toMatchObject({
        ...mockFiles[0],
        url: signedUrl
      });
      expect(result.total).toBe(1);
    });

    it('should handle pagination', async () => {
      // Setup
      const searchQuery = {
        skip: 10,
        take: 5,
        userId: 'user-1'
      };

      mockPrismaService.file.findMany.mockResolvedValue([]);
      mockPrismaService.file.count.mockResolvedValue(0);

      // Execute
      const result = await service.search(searchQuery);

      // Verify
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: { userId: searchQuery.userId },
        skip: 10,
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle S3 signed URL generation failure gracefully', async () => {
      // Setup
      const mockFiles = [
        {
          id: 'file-1',
          name: 'test1.txt',
          type: 'text/plain',
          size: 1024,
          url: 'https://test-bucket.s3.amazonaws.com/test-user/test1.txt',
          userId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockPrismaService.file.count.mockResolvedValue(1);
      mockS3Service.getSignedUrl.mockRejectedValue(new Error('S3 Error'));

      // Execute
      const result = await service.search({ userId: 'user-1' });

      // Verify
      expect(result.items[0]).toMatchObject({
        ...mockFiles[0],
        url: mockFiles[0].url // Should keep original URL on error
      });
      expect(result.total).toBe(1);
    });
  });
}); 