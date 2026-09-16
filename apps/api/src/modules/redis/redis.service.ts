import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (this.client.status !== 'ready') {
        try {
          await Promise.race([
            this.client.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout')), 1000)),
          ]);
        } catch {
          return false;
        }
      }
      const pong = await Promise.race([
        this.client.ping(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 1000)),
      ]);
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Redis client', error);
    }
  }
}
