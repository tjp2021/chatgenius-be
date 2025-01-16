import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { VectorStoreService } from '../lib/vector-store.service';
import { BadRequestException } from '@nestjs/common';
import { OpenAI } from 'openai';

// Mock OpenAI
const mockOpenAICreate = jest.fn();
const mockOpenAI = {
  chat: {
    completions: {
      create: mockOpenAICreate
    }
  }
};

jest.mock('openai', () => ({
  OpenAI: jest.fn(() => mockOpenAI)
}));

describe('AiService', () => {
  let service: AiService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    message: {
      findMany: jest.fn()
    },
    userAvatar: {
      findUnique: jest.fn()
    }
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-api-key')
  };

  const mockVectorStoreService = {
    findSimilarMessages: jest.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
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
          useValue: mockVectorStoreService
        }
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    prismaService = module.get<PrismaService>(PrismaService);
    
    // Initialize OpenAI mock
    await service.onModuleInit();
  });

  describe('analyzeUserStyle', () => {
    it('should throw BadRequestException if insufficient messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValueOnce([]);
      
      await expect(service.analyzeUserStyle('user123')).rejects.toThrow(BadRequestException);
    });

    it('should return structured style analysis', async () => {
      const mockMessages = Array(10).fill({
        content: 'Test message content',
        createdAt: new Date()
      });

      const mockAnalysis = {
        tone: 'casual',
        vocabulary: 'simple',
        messageLength: 'short',
        commonPhrases: ['hello', 'thanks']
      };

      mockPrismaService.message.findMany.mockResolvedValueOnce(mockMessages);
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(mockAnalysis)
          }
        }]
      });

      const result = await service.analyzeUserStyle('user123');

      expect(result).toHaveProperty('userId', 'user123');
      expect(result).toHaveProperty('messageCount');
      expect(result).toHaveProperty('styleAnalysis');
      expect(result.styleAnalysis).toHaveProperty('tone');
      expect(result.styleAnalysis).toHaveProperty('vocabulary');
      expect(result.styleAnalysis).toHaveProperty('messageLength');
      expect(result.styleAnalysis).toHaveProperty('commonPhrases');
      expect(result.styleAnalysis).toHaveProperty('confidence');
      expect(Array.isArray(result.styleAnalysis.commonPhrases)).toBe(true);
    });

    it('should calculate confidence score correctly', async () => {
      const mockMessages = Array(10).fill({
        content: 'Test message content',
        createdAt: new Date()
      });

      const mockAnalysis = {
        tone: 'casual',
        vocabulary: 'simple',
        messageLength: 'short',
        commonPhrases: ['hello', 'thanks']
      };

      mockPrismaService.message.findMany.mockResolvedValueOnce(mockMessages);
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(mockAnalysis)
          }
        }]
      });

      const result = await service.analyzeUserStyle('user123');
      
      expect(result.styleAnalysis.confidence).toBe(0.5); // 10/20 = 0.5
    });

    it('should handle OpenAI response correctly', async () => {
      const mockMessages = Array(10).fill({
        content: 'Test message content',
        createdAt: new Date()
      });

      const mockAnalysis = {
        tone: 'formal',
        vocabulary: 'advanced',
        messageLength: 'long',
        commonPhrases: ['indeed', 'moreover', 'therefore']
      };

      mockPrismaService.message.findMany.mockResolvedValueOnce(mockMessages);
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(mockAnalysis)
          }
        }]
      });

      const result = await service.analyzeUserStyle('user123');

      expect(result.styleAnalysis.tone).toBe(mockAnalysis.tone);
      expect(result.styleAnalysis.vocabulary).toBe(mockAnalysis.vocabulary);
      expect(result.styleAnalysis.messageLength).toBe(mockAnalysis.messageLength);
      expect(result.styleAnalysis.commonPhrases).toEqual(mockAnalysis.commonPhrases);
    });
  });

  describe('generateAvatarResponse', () => {
    it('should throw BadRequestException if avatar not found', async () => {
      mockPrismaService.userAvatar = {
        findUnique: jest.fn().mockResolvedValueOnce(null)
      };

      await expect(service.generateAvatarResponse('user123', 'test prompt'))
        .rejects.toThrow(BadRequestException);
    });

    it('should generate response using style analysis', async () => {
      const mockStyle = {
        tone: 'formal',
        vocabulary: 'advanced',
        messageLength: 'long',
        commonPhrases: ['indeed', 'moreover', 'therefore']
      };

      const mockAvatar = {
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: 'msg123',
            analysis: mockStyle
          }
        })
      };

      mockPrismaService.userAvatar = {
        findUnique: jest.fn().mockResolvedValueOnce(mockAvatar)
      };

      const mockResponse = 'Generated response following the style';
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: mockResponse
          }
        }]
      });

      const result = await service.generateAvatarResponse('user123', 'test prompt');

      expect(result).toBe(mockResponse);
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining(mockStyle.tone)
            }),
            expect.objectContaining({
              role: 'user',
              content: 'test prompt'
            })
          ])
        })
      );
    });

    it('should include style characteristics in prompt', async () => {
      const mockStyle = {
        tone: 'casual',
        vocabulary: 'simple',
        messageLength: 'short',
        commonPhrases: ['hey', 'cool', 'awesome']
      };

      const mockAvatar = {
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: 'msg123',
            analysis: mockStyle
          }
        })
      };

      mockPrismaService.userAvatar = {
        findUnique: jest.fn().mockResolvedValueOnce(mockAvatar)
      };

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Test response'
          }
        }]
      });

      await service.generateAvatarResponse('user123', 'test prompt');

      const systemPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content;
      expect(systemPrompt).toContain(`Tone: ${mockStyle.tone}`);
      expect(systemPrompt).toContain(`Vocabulary Level: ${mockStyle.vocabulary}`);
      expect(systemPrompt).toContain(`Message Length: ${mockStyle.messageLength}`);
      expect(systemPrompt).toContain(mockStyle.commonPhrases.join(', '));
    });

    it('should include similar messages as context', async () => {
      const mockStyle = {
        tone: 'casual',
        vocabulary: 'simple',
        messageLength: 'short',
        commonPhrases: ['hey', 'cool', 'awesome']
      };

      const mockAvatar = {
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: 'msg123',
            analysis: mockStyle
          }
        })
      };

      const mockSimilarMessages = [
        { 
          id: 'msg1',
          content: 'Previous message 1',
          score: 0.9,
          metadata: {
            timestamp: new Date('2024-01-16T10:00:00Z')
          }
        },
        { 
          id: 'msg2',
          content: 'Previous message 2',
          score: 0.85,
          metadata: {
            timestamp: new Date('2024-01-16T10:01:00Z')
          }
        }
      ];

      mockPrismaService.userAvatar = {
        findUnique: jest.fn().mockResolvedValueOnce(mockAvatar)
      };

      mockVectorStoreService.findSimilarMessages.mockResolvedValueOnce(mockSimilarMessages);

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Test response'
          }
        }]
      });

      await service.generateAvatarResponse('user123', 'test prompt');

      const systemPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content;
      
      // Verify messages are included
      expect(systemPrompt).toContain('Previous message 1');
      expect(systemPrompt).toContain('Previous message 2');
    });

    it('should group messages by thread and maintain chronological order', async () => {
      const mockStyle = {
        tone: 'casual',
        vocabulary: 'simple',
        messageLength: 'short',
        commonPhrases: ['hey', 'cool', 'awesome']
      };

      const mockAvatar = {
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: 'msg123',
            analysis: mockStyle
          }
        })
      };

      const thread1Messages = [
        { 
          id: 'msg1',
          content: 'Thread 1 first message',
          score: 0.9,
          metadata: {
            timestamp: new Date('2024-01-16T10:00:00Z')
          }
        },
        { 
          id: 'msg2',
          content: 'Thread 1 reply',
          score: 0.8,
          metadata: {
            replyTo: 'msg1',
            timestamp: new Date('2024-01-16T10:01:00Z')
          }
        }
      ];

      const thread2Messages = [
        {
          id: 'msg3',
          content: 'Thread 2 message',
          score: 0.7,
          metadata: {
            timestamp: new Date('2024-01-16T10:02:00Z')
          }
        }
      ];

      mockPrismaService.userAvatar = {
        findUnique: jest.fn().mockResolvedValueOnce(mockAvatar)
      };

      mockVectorStoreService.findSimilarMessages.mockResolvedValueOnce([
        ...thread1Messages,
        ...thread2Messages
      ]);

      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Test response'
          }
        }]
      });

      await service.generateAvatarResponse('user123', 'test prompt');

      const systemPrompt = mockOpenAICreate.mock.calls[0][0].messages[0].content;
      
      // Verify thread structure
      expect(systemPrompt).toContain('Thread 1 first message\n  ↪ Thread 1 reply');
      expect(systemPrompt).toContain('Thread 2 message');
      
      // Verify order (thread1 should come first due to higher score)
      const thread1Index = systemPrompt.indexOf('Thread 1');
      const thread2Index = systemPrompt.indexOf('Thread 2');
      expect(thread1Index).toBeLessThan(thread2Index);
    });
  });
}); 