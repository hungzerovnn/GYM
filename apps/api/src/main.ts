import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  const appUrl = config.get<string>('APP_URL', 'http://localhost:3000');
  const port = Number(config.get<string>('PORT', '6273'));
  const expressApp = app.getHttpAdapter().getInstance() as {
    listen: (
      port: number,
      host: string,
      callback: () => void,
    ) => { on: (event: string, handler: (error: Error) => void) => void };
  };
  const extraOrigins = (config.get<string>('CORS_ALLOWED_ORIGINS', '') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(
    new Set([
      appUrl,
      'http://localhost:6173',
      'http://127.0.0.1:6173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...extraOrigins,
    ]),
  );

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-key'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FitFlow Enterprise API')
    .setDescription('Gym and fitness management API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, '0.0.0.0');

  const fallbackPorts = Array.from(new Set([6273, 6173, 8080])).filter(
    (candidate) => candidate !== port,
  );

  fallbackPorts.forEach((fallbackPort) => {
    try {
      const server = expressApp.listen(
        fallbackPort,
        '0.0.0.0',
        () => undefined,
      );
      server.on('error', () => undefined);
    } catch {
      // ignore fallback port bind errors
    }
  });
}

void bootstrap();
