import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { EmailUtil } from './common/utils/email.util';
import * as cookieParser from 'cookie-parser';

async function Start() {
  const app = await NestFactory.create(AppModule);

  // Initialize EmailUtil
  const configService = app.get(ConfigService);
  await EmailUtil.initialize(configService);

  const config = new DocumentBuilder()
    .setTitle('Twilsta API')
    .setDescription('API mô tả cho ứng dụng mạng xã hội')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 4000);
}

Start();
