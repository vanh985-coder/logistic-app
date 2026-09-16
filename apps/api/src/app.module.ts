import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { pinoConfig } from './common/logger/pino.config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    LoggerModule.forRoot(pinoConfig),
    PrismaModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
