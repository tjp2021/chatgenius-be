import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  
  // Configure JSON parsing with raw body access
  app.use(json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  
  // Configure CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',')[0], // Use only the HTTP origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  
  app.useGlobalPipes(new ValidationPipe());
  
  await app.listen(process.env.PORT || 3001);
}
bootstrap();
