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
  
  // ******************** DO NOT FUCKING TOUCH THIS PORT ********************
  // Everything (HTTP + WebSocket) runs on port 3001
  // This port is specifically configured for ngrok tunneling
  // Changing this will break everything. You have been warned.
  // ********************************************************************* 
  const PORT = 3001;
  
  // Configure CORS for both HTTP and WebSocket
  const corsOrigins = process.env.FRONTEND_URL?.split(',') || [];
  app.enableCors({
    origin: ['*', ...corsOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'svix-id',
      'svix-timestamp',
      'svix-signature'
    ],
    exposedHeaders: [
      'svix-id',
      'svix-timestamp',
      'svix-signature'
    ],
  });

  // Configure WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe());
  
  // Start server
  await app.listen(PORT);
  console.log(`🚀 Server running on port ${PORT}`);
}
bootstrap();
