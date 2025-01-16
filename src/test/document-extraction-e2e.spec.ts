import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../app.module';
import * as path from 'path';

describe('Document Extraction (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ai/extract-document (POST) - should extract markdown content', () => {
    const fileId = 'test-file-id';
    
    return supertest(app.getHttpServer())
      .post('/ai/extract-document')
      .send({ fileId })
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('content');
        expect(res.body).toHaveProperty('fileType', 'text/markdown');
        expect(res.body).toHaveProperty('extractedAt');
        expect(typeof res.body.content).toBe('string');
        expect(res.body.content.length).toBeGreaterThan(0);
      });
  });

  afterAll(async () => {
    await app.close();
  });
}); 