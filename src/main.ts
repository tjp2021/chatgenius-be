import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  
  // Important: This needs to come before other middleware
  app.use(bodyParser.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));
  
  // ******************** DO NOT FUCKING TOUCH THIS PORT ********************
  // Everything (HTTP + WebSocket) runs on port 3001
  // This port is specifically configured for ngrok tunneling
  // Changing this will break everything. You have been warned.
  // ********************************************************************* 
  const PORT = 3001;
  
  // Configure CORS for both HTTP and WebSocket
  app.enableCors({
    origin: ['http://localhost:3000', 'https://localhost:3000'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'svix-id',
      'svix-timestamp',
      'svix-signature',
      'x-user-id',
      'x-retry-count'
    ],
    exposedHeaders: [
      'svix-id',
      'svix-timestamp',
      'svix-signature'
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Configure WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));
  
  // Set global API prefix
  app.setGlobalPrefix('api');
  
  // Global validation pipe with transformation enabled
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true }
  }));
  
  // Start server
  await app.listen(PORT);
  console.log(`🚀 Server running on port ${PORT}`);
}
bootstrap();
