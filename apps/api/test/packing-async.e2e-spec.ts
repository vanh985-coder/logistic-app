import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Worker } from 'bullmq';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { packContainers } from '@logix/packing';
import { CompanyType, CompanyStatus, UserRole, UserStatus } from '@logix/shared';

describe('Phase 4: 3D Packing Engine Async Queue & Redis Cache (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;
  let passwordService: PasswordService;
  let testWorker: Worker;

  const testId = Date.now().toString();
  let tokenFwd: string;

  const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    redisService = app.get(RedisService);
    passwordService = app.get(PasswordService);

    // 1. Register & Login Forwarder
    const passHash = await passwordService.hashPassword('FwdPassword123!');
    const fwdCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-FWD-PACK-${testId}`,
        name: `Forwarder Packing Test ${testId}`,
        type: CompanyType.FWD,
        status: CompanyStatus.VERIFIED,
      },
    });

    await prisma.unsafeGlobal.user.create({
      data: {
        companyId: fwdCompany.id,
        email: `fwd_pack_${testId}@example.com`,
        passwordHash: passHash,
        role: UserRole.FWD_ADMIN,
        status: UserStatus.ACTIVE,
        fullName: 'Forwarder Packing Dispatcher',
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `fwd_pack_${testId}@example.com`, password: 'FwdPassword123!' })
      .expect(200);

    tokenFwd = loginRes.body.accessToken;

    // 2. Start test BullMQ Worker mirroring apps/worker
    testWorker = new Worker(
      'packing_queue',
      async (job) => {
        const { container, packages, options, inputHash } = job.data;
        const result = packContainers(container, packages, options);

        if (inputHash) {
          const cacheKey = `packing:result:${inputHash}`;
          await redisService.getClient().set(cacheKey, JSON.stringify(result), 'EX', 3600);
        }

        return result;
      },
      { connection: redisOptions, concurrency: 1 },
    );
  });

  afterAll(async () => {
    await testWorker.close();
    await app.close();
  });

  it('1. POST /packing/calculate should accept job and return HTTP 202 Accepted', async () => {
    const container = {
      innerLengthMm: 5898,
      innerWidthMm: 2352,
      innerHeightMm: 2393,
      maxPayloadGram: 28200000,
    };

    const packages = [
      {
        id: `PKG-A-${testId}`,
        lengthMm: 1200,
        widthMm: 800,
        heightMm: 1000,
        weightGram: 300000,
        fragile: false,
        noStack: false,
        rotatable: true,
      },
      {
        id: `PKG-B-${testId}`,
        lengthMm: 1000,
        widthMm: 1000,
        heightMm: 1000,
        weightGram: 400000,
        fragile: false,
        noStack: false,
        rotatable: true,
      },
    ];

    const res = await request(app.getHttpServer())
      .post('/packing/calculate')
      .set('Authorization', `Bearer ${tokenFwd}`)
      .send({ container, packages })
      .expect(202);

    expect(res.body.statusCode).toBe(202);
    expect(res.body.status).toBe('processing');
    expect(res.body.jobId).toBeDefined();
    expect(res.body.inputHash).toBeDefined();

    const jobId = res.body.jobId;

    // 2. Poll GET /packing/jobs/:jobId until completed
    let pollRes;
    const maxRetries = 20;
    for (let i = 0; i < maxRetries; i++) {
      pollRes = await request(app.getHttpServer())
        .get(`/packing/jobs/${jobId}`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);

      if (pollRes.body.status === 'completed' || pollRes.body.status === 'failed') {
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    expect(pollRes?.body.status).toBe('completed');
    expect(pollRes?.body.result).toBeDefined();

    const packingResult = pollRes?.body.result;
    expect(packingResult.placedPackages.length).toBe(2);
    expect(packingResult.centerOfGravity.xPercentage).toBeGreaterThanOrEqual(45.0);
    expect(packingResult.centerOfGravity.xPercentage).toBeLessThanOrEqual(55.0);
    expect(packingResult.cogViolation).toBe(false); // Successfully centered into safety corridor [45%, 55%]

    // 3. Second call with identical input should HIT Redis Cache (HTTP 200, cached: true)
    const cachedRes = await request(app.getHttpServer())
      .post('/packing/calculate')
      .set('Authorization', `Bearer ${tokenFwd}`)
      .send({ container, packages })
      .expect(200);

    expect(cachedRes.body.statusCode).toBe(200);
    expect(cachedRes.body.status).toBe('completed');
    expect(cachedRes.body.cached).toBe(true);
    expect(cachedRes.body.result.placedPackages.length).toBe(2);
    expect(cachedRes.body.result.fillRateBps).toBe(packingResult.fillRateBps);
  });

  it('2. GET /packing/jobs/:jobId with non-existent jobId should return HTTP 404', async () => {
    await request(app.getHttpServer())
      .get('/packing/jobs/non-existent-job-9999')
      .set('Authorization', `Bearer ${tokenFwd}`)
      .expect(404);
  });
});
