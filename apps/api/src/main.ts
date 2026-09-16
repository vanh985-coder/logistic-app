import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  // Security headers & disabled x-powered-by
  app.use(helmet());

  // CORS whitelist
  const allowedOrigins = [
    process.env.WEB_URL || 'http://localhost:3000',
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
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
