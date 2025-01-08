import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';

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
  
  // Configure CORS for both HTTP and WebSocket
  const corsOrigins = process.env.FRONTEND_URL?.split(',') || [];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  // Configure WebSocket
  const ioAdapter = new IoAdapter(app);
  ioAdapter.createIOServer(3002, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });
  app.useWebSocketAdapter(ioAdapter);
  
  app.useGlobalPipes(new ValidationPipe());
  
  await app.listen(3002);
}
bootstrap();
