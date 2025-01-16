import { Test, TestingModule } from '@nestjs/testing';
import { FileContentService } from '../lib/file-content.service';
import { S3Service } from '../modules/files/services/s3.service';

describe('FileContentService', () => {
  let service: FileContentService;
  let s3Service: S3Service;

  const mockS3Service = {
    getSignedUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileContentService,
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    service = module.get<FileContentService>(FileContentService);
    s3Service = module.get<S3Service>(S3Service);

    // Reset all mocks before each test
    global.fetch = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractTextContent', () => {
    it('should extract text content from a txt file', async () => {
      const mockContent = 'Test file content';
      const mockSignedUrl = 'https://test-url.com/file.txt';
      
      mockS3Service.getSignedUrl.mockResolvedValue(mockSignedUrl);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockContent),
      });

      const result = await service.extractTextContent('test.txt');
      expect(result).toBe(mockContent);
      expect(mockS3Service.getSignedUrl).toHaveBeenCalledWith('test.txt');
      expect(global.fetch).toHaveBeenCalledWith(mockSignedUrl);
    });

    it('should throw error for non-txt files', async () => {
      await expect(service.extractTextContent('test.pdf')).rejects.toThrow(
        'Only .txt files are supported in this version'
      );
    });

    it('should handle fetch errors', async () => {
      const mockSignedUrl = 'https://test-url.com/file.txt';
      mockS3Service.getSignedUrl.mockResolvedValue(mockSignedUrl);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.extractTextContent('test.txt')).rejects.toThrow(
        'Failed to fetch file: Not Found'
      );
    });
  });
}); 