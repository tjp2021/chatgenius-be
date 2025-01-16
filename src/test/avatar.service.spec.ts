import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from '../lib/avatar.service';
import { PrismaService } from '../lib/prisma.service';
import { ResponseSynthesisService } from '../lib/response-synthesis.service';
import { VectorStoreService } from '../lib/vector-store.service';
import { BadRequestException } from '@nestjs/common';

describe('AvatarService', () => {
  let service: AvatarService;
  let prismaService: PrismaService;
  let synthesisService: ResponseSynthesisService;
  let vectorStore: VectorStoreService;

  const mockPrismaService = {
    message: {
      findMany: jest.fn()
    },
    userAvatar: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };

  const mockSynthesisService = {
    synthesizeResponse: jest.fn()
  };

  const mockVectorStore = {
    findSimilarMessages: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: ResponseSynthesisService,
          useValue: mockSynthesisService
        },
        {
          provide: VectorStoreService,
          useValue: mockVectorStore
        }
      ],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
    prismaService = module.get<PrismaService>(PrismaService);
    synthesisService = module.get<ResponseSynthesisService>(ResponseSynthesisService);
    vectorStore = module.get<VectorStoreService>(VectorStoreService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAvatar', () => {
    it('should throw BadRequestException if insufficient messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      await expect(service.createAvatar('test-user')).rejects.toThrow(BadRequestException);
    });

    it('should create avatar with message analysis', async () => {
      const messages = [
        { id: '1', content: 'Test message 1', createdAt: new Date() },
        { id: '2', content: 'Test message 2', createdAt: new Date() },
        { id: '3', content: 'Test message 3', createdAt: new Date() },
        { id: '4', content: 'Test message 4', createdAt: new Date() },
        { id: '5', content: 'Test message 5', createdAt: new Date() }
      ];

      mockPrismaService.message.findMany.mockResolvedValue(messages);
      mockSynthesisService.synthesizeResponse.mockResolvedValue({ response: 'Test analysis' });
      mockPrismaService.userAvatar.create.mockResolvedValue({
        id: 'test-avatar',
        userId: 'test-user',
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: '1',
            analysis: 'Test analysis'
          }
        }),
        updatedAt: new Date()
      });

      const result = await service.createAvatar('test-user');

      expect(result.id).toBe('test-avatar');
      expect(result.userId).toBe('test-user');
      expect(result.messageAnalysis.analysis).toBe('Test analysis');
    });
  });

  describe('generateResponse', () => {
    it('should throw BadRequestException if prompt is empty', async () => {
      await expect(service.generateResponse('test-user', '')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if avatar not found', async () => {
      mockPrismaService.userAvatar.findUnique.mockResolvedValue(null);

      await expect(service.generateResponse('test-user', 'test prompt')).rejects.toThrow(BadRequestException);
    });

    it('should generate response using avatar style', async () => {
      mockPrismaService.userAvatar.findUnique.mockResolvedValue({
        id: 'test-avatar',
        userId: 'test-user',
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: '1',
            analysis: 'Test analysis'
          }
        }),
        updatedAt: new Date()
      });

      mockVectorStore.findSimilarMessages.mockResolvedValue([
        { content: 'Similar message 1' },
        { content: 'Similar message 2' }
      ]);

      mockSynthesisService.synthesizeResponse.mockResolvedValue({ response: 'Generated response' });

      const result = await service.generateResponse('test-user', 'test prompt');

      expect(result).toBe('Generated response');
      expect(mockSynthesisService.synthesizeResponse).toHaveBeenCalledWith(expect.objectContaining({
        channelId: 'avatar-response',
        prompt: expect.stringContaining('test prompt')
      }));
    });
  });

  describe('updateAvatar', () => {
    it('should throw NotFoundException if avatar not found', async () => {
      mockPrismaService.userAvatar.findUnique.mockResolvedValue(null);

      await expect(service.updateAvatar('test-user')).rejects.toThrow('Avatar not found');
    });

    it('should throw BadRequestException if insufficient messages', async () => {
      mockPrismaService.userAvatar.findUnique.mockResolvedValue({
        id: 'test-avatar',
        userId: 'test-user'
      });
      mockPrismaService.message.findMany.mockResolvedValue([]);

      await expect(service.updateAvatar('test-user')).rejects.toThrow(BadRequestException);
    });

    it('should update avatar with new analysis', async () => {
      const messages = [
        { id: '1', content: 'Test message 1', createdAt: new Date() },
        { id: '2', content: 'Test message 2', createdAt: new Date() },
        { id: '3', content: 'Test message 3', createdAt: new Date() },
        { id: '4', content: 'Test message 4', createdAt: new Date() },
        { id: '5', content: 'Test message 5', createdAt: new Date() }
      ];

      mockPrismaService.userAvatar.findUnique.mockResolvedValue({
        id: 'test-avatar',
        userId: 'test-user'
      });
      mockPrismaService.message.findMany.mockResolvedValue(messages);
      mockSynthesisService.synthesizeResponse.mockResolvedValue({ response: 'Updated analysis' });
      mockPrismaService.userAvatar.update.mockResolvedValue({
        id: 'test-avatar',
        userId: 'test-user',
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: '1',
            analysis: 'Updated analysis'
          }
        }),
        updatedAt: new Date()
      });

      const result = await service.updateAvatar('test-user');

      expect(result.id).toBe('test-avatar');
      expect(result.userId).toBe('test-user');
      expect(result.messageAnalysis.analysis).toBe('Updated analysis');
    });
  });
}); 