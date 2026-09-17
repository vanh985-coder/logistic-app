import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../../.env' });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Support BigInt JSON serialization globally
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  // Security headers & disabled x-powered-by
  app.use(helmet());

  // Parse cookies (for HttpOnly refresh tokens)
  app.use(cookieParser());

  // CORS whitelist with strict environment guard
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins: (string | RegExp)[] = isProduction
    ? (process.env.WEB_URL ? process.env.WEB_URL.split(',').map((u) => u.trim()) : ['http://localhost:3000'])
    : [
        process.env.WEB_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://[::1]:3000',
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
      ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept'],
  });

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`LOGIX-3D API Server running on port ${port} [NODE_ENV=${process.env.NODE_ENV || 'development'}]`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during application bootstrap', err);
  process.exit(1);
});
