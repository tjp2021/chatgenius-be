import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException, NotFoundException } from '@nestjs/common';
import supertest from 'supertest';
import { AiService } from '../lib/ai.service';
import { PrismaService } from '../lib/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AiController } from '../controllers/ai.controller';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';

// Mock ClerkAuthGuard
const mockClerkAuthGuard = {
  canActivate: (context) => {
    return true; // Always allow during tests
  },
};

describe('Avatar (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const mockPrismaService = {
    message: {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', content: 'Test message 1', createdAt: new Date() },
        { id: '2', content: 'Test message 2', createdAt: new Date() },
        { id: '3', content: 'Test message 3', createdAt: new Date() },
        { id: '4', content: 'Test message 4', createdAt: new Date() },
        { id: '5', content: 'Test message 5', createdAt: new Date() }
      ])
    },
    userAvatar: {
      create: jest.fn().mockResolvedValue({
        id: 'test-avatar-id',
        userId: 'test-user-id',
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: '1',
            analysis: 'Test analysis'
          }
        }),
        updatedAt: new Date()
      }),
      findUnique: jest.fn().mockImplementation((query) => {
        if (query.where.userId === 'test-user-id') {
          return {
            id: 'test-avatar-id',
            userId: 'test-user-id',
            analysis: JSON.stringify({
              messageAnalysis: {
                timestamp: new Date(),
                lastMessageId: '1',
                analysis: 'Test analysis'
              }
            }),
            updatedAt: new Date()
          };
        }
        return null;
      })
    }
  };

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: {
            createUserAvatar: jest.fn().mockResolvedValue({
              id: 'test-avatar-id',
              userId: 'test-user-id',
              messageAnalysis: {
                timestamp: new Date(),
                lastMessageId: '1',
                analysis: 'Test analysis'
              },
              updatedAt: new Date()
            }),
            generateAvatarResponse: jest.fn().mockImplementation((userId) => {
              // Simulate missing avatar for non-existent user
              if (userId === 'non-existent-user') {
                throw new BadRequestException('Avatar not found. Please create an avatar first.');
              }
              return 'Mocked response';
            }),
            analyzeUserStyle: jest.fn().mockResolvedValue({
              userId: 'test-user-id',
              messageCount: 5,
              styleAnalysis: 'Test style analysis'
            }),
            onModuleInit: jest.fn(),
            updateUserAvatar: jest.fn().mockImplementation((userId) => {
              if (userId === 'non-existent-user') {
                throw new NotFoundException('Avatar not found');
              }
              return {
                id: 'test-avatar-id',
                userId: 'test-user-id',
                messageAnalysis: {
                  timestamp: new Date(),
                  lastMessageId: '1',
                  analysis: 'Updated analysis'
                },
                updatedAt: new Date()
              };
            }),
            searchMessages: jest.fn().mockResolvedValue([
              {
                id: 'msg1',
                content: 'Test message content',
                userId: 'test-user-id',
                channelId: 'channel1',
                createdAt: new Date()
              }
            ])
          }
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: ConfigService,
          useValue: {
            get: () => 'fake-api-key'
          }
        }
      ]
    })
    .overrideGuard(ClerkAuthGuard)  // Override the auth guard
    .useValue(mockClerkAuthGuard)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  describe('/ai/avatar (POST)', () => {
    it('should create an avatar', () => {
      return supertest(app.getHttpServer())
        .post('/ai/avatar')
        .send({ userId: 'test-user-id' })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('userId', 'test-user-id');
          expect(res.body).toHaveProperty('messageAnalysis');
          expect(res.body.messageAnalysis).toHaveProperty('analysis');
        });
    });

    it('should handle missing user', () => {
      return supertest(app.getHttpServer())
        .post('/ai/avatar')
        .send({})
        .expect(400);
    });
  });

  describe('/ai/avatar/response (POST)', () => {
    it('should generate avatar response', () => {
      return supertest(app.getHttpServer())
        .post('/ai/avatar/response')
        .send({
          userId: 'test-user-id',
          prompt: 'Hello!'
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('response');
          expect(typeof res.body.response).toBe('string');
        });
    });

    it('should handle missing avatar', () => {
      return supertest(app.getHttpServer())
        .post('/ai/avatar/response')
        .send({
          userId: 'non-existent-user',
          prompt: 'Hello!'
        })
        .expect(400);
    });
  });

  describe('/ai/avatar/update (POST)', () => {
    it('should update avatar analysis', () => {
      return supertest(app.getHttpServer())
        .post('/ai/avatar/update')
        .send({ userId: 'test-user-id' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('userId', 'test-user-id');
          expect(res.body).toHaveProperty('messageAnalysis');
          expect(res.body.messageAnalysis).toHaveProperty('analysis');
        });
    });

    it('should handle non-existent avatar', () => {
      return supertest(app.getHttpServer())
        .post('/ai/avatar/update')
        .send({ userId: 'non-existent-user' })
        .expect(404);
    });
  });

  describe('/ai/messages/search (POST)', () => {
    it('should search messages', () => {
      return supertest(app.getHttpServer())
        .post('/ai/messages/search')
        .send({
          query: 'test',
          userId: 'test-user-id'
        })
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('content');
          expect(res.body[0]).toHaveProperty('userId');
          expect(res.body[0]).toHaveProperty('createdAt');
        });
    });

    it('should validate search request', () => {
      return supertest(app.getHttpServer())
        .post('/ai/messages/search')
        .send({})  // Missing required query
        .expect(400);
    });
  });

  afterAll(async () => {
    await app.close();
  });
}); 