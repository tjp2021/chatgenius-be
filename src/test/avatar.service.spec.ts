import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from '../lib/avatar.service';
import { PrismaService } from '../lib/prisma.service';
import { ResponseSynthesisService } from '../lib/response-synthesis.service';
import { VectorStoreService } from '../lib/vector-store.service';
import { BadRequestException } from '@nestjs/common';
import { Message, UserAvatar, Prisma } from '@prisma/client';

// Temporary interface until we move it to its own file
interface SynthesisResponse {
  response: string;
  contextMessageCount: number;
}

describe('AvatarService', () => {
  let service: AvatarService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockSynthesisService: jest.Mocked<ResponseSynthesisService>;
  let mockVectorStoreService: jest.Mocked<VectorStoreService>;

  beforeEach(async () => {
    mockPrismaService = {
      message: {
        findMany: jest.fn() as jest.MockedFunction<PrismaService['message']['findMany']>
      },
      userAvatar: {
        create: jest.fn() as jest.MockedFunction<PrismaService['userAvatar']['create']>,
        findUnique: jest.fn() as jest.MockedFunction<PrismaService['userAvatar']['findUnique']>,
        update: jest.fn() as jest.MockedFunction<PrismaService['userAvatar']['update']>
      }
    } as any;

    mockSynthesisService = {
      synthesizeResponse: jest.fn()
    } as any;

    mockVectorStoreService = {
      findSimilarMessages: jest.fn()
    } as any;

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
          useValue: mockVectorStoreService
        }
      ],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAvatar', () => {
    const mockStyleAnalysis = {
      tone: 'formal',
      vocabulary: 'technical'
    };

    const mockMessages = [
      { id: '1', content: 'Test message 1', createdAt: new Date() },
      { id: '2', content: 'Test message 2', createdAt: new Date() },
      { id: '3', content: 'Test message 3', createdAt: new Date() },
      { id: '4', content: 'Test message 4', createdAt: new Date() },
      { id: '5', content: 'Test message 5', createdAt: new Date() }
    ] as Message[];

    it('should throw BadRequestException if insufficient messages', async () => {
      (mockPrismaService.message.findMany as jest.Mock).mockResolvedValue([]);
      await expect(service.createAvatar('test-user')).rejects.toThrow(BadRequestException);
    });

    it('should create avatar with structured style analysis', async () => {
      (mockPrismaService.message.findMany as jest.Mock).mockResolvedValue(mockMessages);
      (mockSynthesisService.synthesizeResponse as jest.Mock).mockResolvedValue({ 
        response: JSON.stringify(mockStyleAnalysis),
        contextMessageCount: 5
      } as SynthesisResponse);

      (mockPrismaService.userAvatar.create as jest.Mock).mockResolvedValue({
        id: 'test-avatar',
        userId: 'test-user',
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: '1',
            analysis: mockStyleAnalysis
          }
        }),
        updatedAt: new Date()
      } as UserAvatar);

      const result = await service.createAvatar('test-user');

      expect(result.id).toBe('test-avatar');
      expect(result.userId).toBe('test-user');
      expect(result.messageAnalysis.analysis).toEqual({
        tone: expect.stringMatching(/^(formal|casual)$/),
        vocabulary: expect.stringMatching(/^(technical|simple)$/)
      });
    });

    it('should validate style analysis structure', async () => {
      (mockPrismaService.message.findMany as jest.Mock).mockResolvedValue(mockMessages);
      
      (mockSynthesisService.synthesizeResponse as jest.Mock).mockResolvedValue({ 
        response: JSON.stringify({ 
          tone: 'invalid',
          vocabulary: 'invalid' 
        }),
        contextMessageCount: 5
      } as SynthesisResponse);

      await expect(service.createAvatar('test-user')).rejects.toThrow();
    });
  });

  describe('generateResponse', () => {
    const mockStyleAnalysis = {
      tone: 'formal',
      vocabulary: 'technical'
    };

    const mockTimestamp = new Date().toISOString();

    beforeEach(() => {
      (mockPrismaService.userAvatar.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-avatar',
        userId: 'test-user',
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: '1',
            analysis: mockStyleAnalysis
          }
        }),
        updatedAt: new Date()
      } as UserAvatar);

      (mockVectorStoreService.findSimilarMessages as jest.Mock).mockResolvedValue([
        { 
          id: 'msg1',
          content: 'Similar message 1',
          score: 0.9,
          metadata: { 
            content: 'Similar message 1',
            originalScore: 0.9,
            timeScore: 1.0,
            channelScore: 1.0,
            threadScore: 1.0,
            chunkIndex: 0,
            totalChunks: 1,
            messageId: 'msg1',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: mockTimestamp
          }
        },
        { 
          id: 'msg2',
          content: 'Similar message 2',
          score: 0.8,
          metadata: { 
            content: 'Similar message 2',
            originalScore: 0.8,
            timeScore: 1.0,
            channelScore: 1.0,
            threadScore: 1.0,
            chunkIndex: 0,
            totalChunks: 1,
            messageId: 'msg2',
            channelId: 'channel1',
            userId: 'user1',
            timestamp: mockTimestamp
          }
        }
      ]);

      (mockSynthesisService.synthesizeResponse as jest.Mock).mockResolvedValue({
        response: 'Generated response',
        contextMessageCount: 2
      } as SynthesisResponse);
    });

    it('should generate response using structured style', async () => {
      const result = await service.generateResponse('test-user', 'Hello');
      
      expect(result).toBe('Generated response');
      expect(mockSynthesisService.synthesizeResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining(JSON.stringify(mockStyleAnalysis))
        })
      );
    });

    it('should handle empty prompt', async () => {
      await expect(service.generateResponse('test-user', '')).rejects.toThrow(BadRequestException);
    });

    it('should handle missing avatar', async () => {
      (mockPrismaService.userAvatar.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.generateResponse('test-user', 'Hello')).rejects.toThrow(BadRequestException);
    });
  });
}); 