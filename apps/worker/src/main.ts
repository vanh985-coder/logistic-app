// Worker entry point for LOGIX-3D Packing Engine
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../../.env' });

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { packContainers, ContainerDimension, PackageItem, PackingOptions } from '@logix/packing';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.PINO_PRETTY === 'true'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss' },
        }
      : undefined,
});

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const QUEUE_NAME = 'packing_queue';
const redisClient = new Redis(redisOptions);

logger.info({ msg: 'Starting LOGIX-3D Packing Worker...', redis: `${redisOptions.host}:${redisOptions.port}` });

export interface PackingJobData {
  container: ContainerDimension;
  packages: PackageItem[];
  options?: PackingOptions;
  inputHash?: string;
}

const worker = new Worker<PackingJobData>(
  QUEUE_NAME,
  async (job: Job<PackingJobData>) => {
    logger.info({ msg: 'Processing packing job', jobId: job.id, name: job.name });
    const { container, packages, options, inputHash } = job.data;

    // 1. Run pure TypeScript 3D Extreme Point Packing Engine
    const result = packContainers(container, packages, options);

    // 2. Cache result in Redis if inputHash is provided (TTL = 1 hour = 3600s)
    if (inputHash) {
      const cacheKey = `packing:result:${inputHash}`;
      await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 3600);
      logger.info({ msg: 'Cached packing result in Redis', cacheKey, ttlSeconds: 3600 });
    }

    return result;
  },
  {
    connection: redisOptions,
    concurrency: 2,
  },
);

worker.on('ready', () => {
  logger.info({ msg: 'Worker connected to Redis successfully', queue: QUEUE_NAME });
});

worker.on('completed', (job) => {
  logger.info({ msg: 'Packing job completed successfully', jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error({ msg: 'Packing job failed', jobId: job?.id, error: err.message });
});

worker.on('error', (err) => {
  logger.warn({ msg: 'Worker error', error: err.message });
});

let isShuttingDown = false;

async function shutdown(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ msg: `Received ${signal}. Shutting down LOGIX-3D Packing Worker gracefully...` });
  try {
    await worker.close();
    await redisClient.quit();
    logger.info({ msg: 'BullMQ worker and Redis client closed. Worker shutdown completed.' });
    process.exit(0);
  } catch (error) {
    logger.error({ msg: 'Error during worker shutdown', error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGBREAK', () => shutdown('SIGBREAK'));
process.on('message', (msg) => {
  if (msg === 'shutdown' || msg === 'SIGTERM') {
    shutdown('IPC:SIGTERM');
  }
});

logger.info({ msg: 'Packing Worker listening on queue', queue: QUEUE_NAME });
