import { Test, TestingModule } from '@nestjs/testing';
import { AvatarController } from '../modules/avatar/avatar.controller';
import { AvatarService } from '../lib/avatar.service';
import { BadRequestException } from '@nestjs/common';

describe('AvatarController', () => {
  let controller: AvatarController;
  let service: AvatarService;

  const mockAvatarService = {
    createAvatar: jest.fn(),
    generateResponse: jest.fn(),
    updateAvatar: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvatarController],
      providers: [
        {
          provide: AvatarService,
          useValue: mockAvatarService
        }
      ],
    }).compile();

    controller = module.get<AvatarController>(AvatarController);
    service = module.get<AvatarService>(AvatarService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAvatar', () => {
    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.createAvatar('')).rejects.toThrow(BadRequestException);
    });

    it('should create avatar successfully', async () => {
      const mockResponse = {
        id: 'test-avatar',
        userId: 'test-user',
        messageAnalysis: {
          timestamp: new Date(),
          lastMessageId: 'msg1',
          analysis: 'Test analysis'
        },
        updatedAt: new Date()
      };

      mockAvatarService.createAvatar.mockResolvedValue(mockResponse);

      const result = await controller.createAvatar('test-user');

      expect(result).toBe(mockResponse);
      expect(mockAvatarService.createAvatar).toHaveBeenCalledWith('test-user');
    });
  });

  describe('generateResponse', () => {
    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.generateResponse('', 'test prompt')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if prompt is missing', async () => {
      await expect(controller.generateResponse('test-user', '')).rejects.toThrow(BadRequestException);
    });

    it('should generate response successfully', async () => {
      mockAvatarService.generateResponse.mockResolvedValue('Generated response');

      const result = await controller.generateResponse('test-user', 'test prompt');

      expect(result).toEqual({ response: 'Generated response' });
      expect(mockAvatarService.generateResponse).toHaveBeenCalledWith('test-user', 'test prompt');
    });
  });

  describe('updateAvatar', () => {
    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.updateAvatar('')).rejects.toThrow(BadRequestException);
    });

    it('should update avatar successfully', async () => {
      const mockResponse = {
        id: 'test-avatar',
        userId: 'test-user',
        messageAnalysis: {
          timestamp: new Date(),
          lastMessageId: 'msg1',
          analysis: 'Updated analysis'
        },
        updatedAt: new Date()
      };

      mockAvatarService.updateAvatar.mockResolvedValue(mockResponse);

      const result = await controller.updateAvatar('test-user');

      expect(result).toBe(mockResponse);
      expect(mockAvatarService.updateAvatar).toHaveBeenCalledWith('test-user');
    });
  });
}); 