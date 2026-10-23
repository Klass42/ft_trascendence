// OTel SDK MUST be initialized before anything else
import './telemetry/otel-sdk';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

// Prisma BigInt fields (e.g. File.sizeBytes) are not JSON-serializable by
// default. Emit them as strings so API responses don't throw.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Caddy is the single trusted reverse proxy; preserve the originating client IP for rate limits.
  app.set('trust proxy', 1);

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Backend half of the mandatory front+back validation. DTOs opt in via
  // class-validator decorators; unknown fields are stripped/rejected.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[Backend] Running on http://localhost:${port}`);
}

bootstrap();
