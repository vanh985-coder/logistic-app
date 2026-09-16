import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness probe: returns 200 if the process is alive.
   */
  @Get('live')
  live(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Readiness probe: checks database and redis connectivity.
   */
  @Get('ready')
  async ready(@Res() res: Response) {
    const startTime = Date.now();

    const dbStart = Date.now();
    const dbHealthy = await this.prisma.isHealthy();
    const dbLatency = Date.now() - dbStart;

    const redisStart = Date.now();
    const redisHealthy = await this.redis.isHealthy();
    const redisLatency = Date.now() - redisStart;

    const isAllHealthy = dbHealthy && redisHealthy;
    const isDegraded = !isAllHealthy && (dbHealthy || redisHealthy);

    const responsePayload = {
      status: isAllHealthy ? 'ok' : isDegraded ? 'degraded' : 'error',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      totalLatencyMs: Date.now() - startTime,
      services: {
        database: {
          status: dbHealthy ? 'up' : 'down',
          latencyMs: dbLatency,
        },
        redis: {
          status: redisHealthy ? 'up' : 'down',
          latencyMs: redisLatency,
        },
      },
    };

    if (isAllHealthy) {
      return res.status(HttpStatus.OK).json(responsePayload);
    } else {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(responsePayload);
    }
  }
}
