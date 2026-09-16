import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss' },
        }
      : undefined,
});

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

const QUEUE_NAME = 'packing_queue';

logger.info({ msg: 'Starting LOGIX-3D Packing Worker...', redisUrl });

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    logger.info({ msg: 'Received packing job', jobId: job.id, name: job.name });
    // Phase 4 will execute packing algorithm from @logix/packing
    return { status: 'completed', jobId: job.id };
  },
  {
    connection,
    concurrency: 2,
  },
);

worker.on('completed', (job) => {
  logger.info({ msg: 'Packing job completed successfully', jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error({ msg: 'Packing job failed', jobId: job?.id, error: err.message });
});

worker.on('error', (err) => {
  logger.warn({ msg: 'Worker error', error: err.message });
});

async function shutdown() {
  logger.info('Shutting down LOGIX-3D Packing Worker gracefully...');
  try {
    await worker.close();
    await connection.quit();
    logger.info('Worker shutdown completed.');
    process.exit(0);
  } catch (error) {
    logger.error({ msg: 'Error during worker shutdown', error });
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info({ msg: 'Packing Worker listening on queue', queue: QUEUE_NAME });
