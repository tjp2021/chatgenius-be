import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// DO NOT MODIFY ANY WEBSOCKET CONFIGURATION IN THIS FILE
// The WebSocket server is configured and working correctly
// Any changes to the adapter, path, or CORS settings will break functionality
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

class CustomIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:3002'],
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
        credentials: true
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      serveClient: true
    });
    return server;
  }
}

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// END OF WEBSOCKET CONFIGURATION - DO NOT MODIFY ANYTHING ABOVE
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Configure WebSocket adapter with explicit settings
  const ioAdapter = new CustomIoAdapter(app);
  app.useWebSocketAdapter(ioAdapter);

  // Enable CORS - make it very permissive for testing
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('ChatGenius API')
    .setDescription('The ChatGenius API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Start server
  await app.listen(3002);
  console.log('Server running on http://localhost:3002');
  console.log('WebSocket server running on ws://localhost:3002/socket.io');
}
bootstrap();
