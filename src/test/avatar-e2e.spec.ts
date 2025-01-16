import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AvatarModule } from '../modules/avatar/avatar.module';
import { PrismaService } from '../lib/prisma.service';
import { ResponseSynthesisService } from '../lib/response-synthesis.service';
import { VectorStoreService } from '../lib/vector-store.service';

describe('Avatar (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let synthesisService: ResponseSynthesisService;
  let vectorStore: VectorStoreService;

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
      }),
      update: jest.fn().mockResolvedValue({
        id: 'test-avatar-id',
        userId: 'test-user-id',
        analysis: JSON.stringify({
          messageAnalysis: {
            timestamp: new Date(),
            lastMessageId: '1',
            analysis: 'Updated analysis'
          }
        }),
        updatedAt: new Date()
      })
    }
  };

  const mockSynthesisService = {
    synthesizeResponse: jest.fn().mockResolvedValue({ response: 'Generated response' })
  };

  const mockVectorStore = {
    findSimilarMessages: jest.fn().mockResolvedValue([
      { metadata: { content: 'Similar message 1' } },
      { metadata: { content: 'Similar message 2' } }
    ])
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AvatarModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(ResponseSynthesisService)
      .useValue(mockSynthesisService)
      .overrideProvider(VectorStoreService)
      .useValue(mockVectorStore)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    synthesisService = moduleFixture.get<ResponseSynthesisService>(ResponseSynthesisService);
    vectorStore = moduleFixture.get<VectorStoreService>(VectorStoreService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/avatars (POST)', () => {
    it('should create avatar', () => {
      return request(app.getHttpServer())
        .post('/avatars')
        .send({ userId: 'test-user-id' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
            id: 'test-avatar-id',
            userId: 'test-user-id',
            messageAnalysis: {
              lastMessageId: '1',
              analysis: 'Test analysis'
            }
          });
        });
    });

    it('should return 400 if userId is missing', () => {
      return request(app.getHttpServer())
        .post('/avatars')
        .send({})
        .expect(400);
    });

    it('should return 400 if insufficient messages', () => {
      mockPrismaService.message.findMany.mockResolvedValueOnce([]);

      return request(app.getHttpServer())
        .post('/avatars')
        .send({ userId: 'test-user-id' })
        .expect(400);
    });
  });

  describe('/avatars/:userId/generate (POST)', () => {
    it('should generate response', () => {
      return request(app.getHttpServer())
        .post('/avatars/test-user-id/generate')
        .send({ prompt: 'test prompt' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({
            response: 'Generated response'
          });
        });
    });

    it('should return 400 if prompt is missing', () => {
      return request(app.getHttpServer())
        .post('/avatars/test-user-id/generate')
        .send({})
        .expect(400);
    });

    it('should return 400 if avatar not found', () => {
      return request(app.getHttpServer())
        .post('/avatars/non-existent-user/generate')
        .send({ prompt: 'test prompt' })
        .expect(400);
    });
  });

  describe('/avatars/:userId (PUT)', () => {
    it('should update avatar', () => {
      return request(app.getHttpServer())
        .put('/avatars/test-user-id')
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            id: 'test-avatar-id',
            userId: 'test-user-id',
            messageAnalysis: {
              lastMessageId: '1',
              analysis: 'Updated analysis'
            }
          });
        });
    });

    it('should return 404 if avatar not found', () => {
      return request(app.getHttpServer())
        .put('/avatars/non-existent-user')
        .expect(404);
    });

    it('should return 400 if insufficient messages', () => {
      mockPrismaService.message.findMany.mockResolvedValueOnce([]);

      return request(app.getHttpServer())
        .put('/avatars/test-user-id')
        .expect(400);
    });
  });
}); 