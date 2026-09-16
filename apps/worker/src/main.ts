import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../../.env' });

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';

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
};

const QUEUE_NAME = 'packing_queue';

logger.info({ msg: 'Starting LOGIX-3D Packing Worker...', redis: `${redisOptions.host}:${redisOptions.port}` });

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    logger.info({ msg: 'Received packing job', jobId: job.id, name: job.name });
    // Phase 4 will execute packing algorithm from @logix/packing
    return { status: 'completed', jobId: job.id };
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
    logger.info({ msg: 'BullMQ worker consumer closed. Worker shutdown completed.' });
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
