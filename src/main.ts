import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Explicitly use the Socket.IO adapter so WebSocket connections
  // share the same HTTP server and respect CORS settings
  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Real-Time Chat & Authentication API')
    .setDescription('REST API and Socket.IO WebSocket endpoints for User Auth, User Search, Group Rooms, and Direct Messaging.')
    .setVersion('1.0')
    .addTag('Authentication', 'User registration and login endpoints')
    .addTag('Users', 'User profile and user search endpoints')
    .addTag('Rooms', 'Group chat room creation, listing, discovery, join/leave and invites')
    .addTag('Messages', 'Direct message history and room message history')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
  console.log(`WebSocket gateway available at: ws://localhost:${port}/chat`);
}
bootstrap();
