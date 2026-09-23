import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { CompanyType, CompanyStatus, UserRole, UserStatus } from '@logix/shared';

describe('Multi-Tenant Isolation & RBAC Protection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  const testId = Date.now().toString();

  const companyAPayload = {
    taxCode: `TAX-A-${testId}`,
    companyName: `Company Alpha ${testId}`,
    companyType: CompanyType.SHIPPER,
    email: `alpha_${testId}@example.com`,
    password: 'PasswordAlpha123!',
    fullName: 'Admin Alpha',
  };

  const companyBPayload = {
    taxCode: `TAX-B-${testId}`,
    companyName: `Company Beta ${testId}`,
    companyType: CompanyType.FWD,
    email: `beta_${testId}@example.com`,
    password: 'PasswordBeta123!',
    fullName: 'Admin Beta',
  };

  let tokenA: string;
  let tokenB: string;
  let tokenPlatform: string;

  let userAId: string;
  let userBId: string;
  let companyBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);

    // 1. Register Company A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send(companyAPayload)
      .expect(201);
    userAId = resA.body.user.id;

    // 2. Register Company B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send(companyBPayload)
      .expect(201);
    userBId = resB.body.user.id;
    companyBId = resB.body.company.id;

    // 3. Create Platform Admin using unsafeGlobal
    const platformPassHash = await passwordService.hashPassword('PlatformSuperAdmin123!');
    const platformCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-PLATFORM-${testId}`,
        name: `Platform Ops ${testId}`,
        type: CompanyType.FWD,
        status: CompanyStatus.VERIFIED,
      },
    });

    const platformUser = await prisma.unsafeGlobal.user.create({
      data: {
        companyId: platformCompany.id,
        email: `platform_${testId}@logix.internal`,
        passwordHash: platformPassHash,
        role: UserRole.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
        fullName: 'Platform Super Admin',
      },
    });

    // 4. Log in all 3 users
    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: companyAPayload.email, password: companyAPayload.password })
      .expect(200);
    tokenA = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: companyBPayload.email, password: companyBPayload.password })
      .expect(200);
    tokenB = loginB.body.accessToken;

    const loginP = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: platformUser.email, password: 'PlatformSuperAdmin123!' })
      .expect(200);
    tokenPlatform = loginP.body.accessToken;
  });

  afterAll(async () => {
    try {
      const taxCodes = [companyAPayload.taxCode, companyBPayload.taxCode, `TAX-PLATFORM-${testId}`];
      const testCompanies = await prisma.unsafeGlobal.company.findMany({
        where: { taxCode: { in: taxCodes } },
        select: { id: true },
      });
      const testCompanyIds = testCompanies.map((c: any) => c.id);
      if (testCompanyIds.length > 0) {
        await prisma.unsafeGlobal.refreshToken.deleteMany({
          where: { user: { companyId: { in: testCompanyIds } } },
        });
        await prisma.unsafeGlobal.user.deleteMany({
          where: { companyId: { in: testCompanyIds } },
        });
        await prisma.unsafeGlobal.company.deleteMany({
          where: { id: { in: testCompanyIds } },
        });
      }
    } catch (e) {
      console.warn('Cleanup error in tenant-isolation e2e:', e);
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('1. List isolation: Company A admin calling GET /users only sees Company A users', async () => {
    expect(userAId).toBeDefined();
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const emails = res.body.map((u: any) => u.email);
    expect(emails).toContain(companyAPayload.email.toLowerCase());
    expect(emails).not.toContain(companyBPayload.email.toLowerCase());
  });

  it('2. IDOR Prevention: Company A admin calling GET /users/:id with Company B userId receives 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    expect(res.body.message).toContain(`User with ID '${userBId}' not found`);
  });

  it('3. Super Admin bypass: PLATFORM_ADMIN calling GET /users/:id with Company B userId receives 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userBId}`)
      .set('Authorization', `Bearer ${tokenPlatform}`)
      .expect(200);

    expect(res.body.id).toBe(userBId);
    expect(res.body.email).toBe(companyBPayload.email.toLowerCase());
  });

  it('4. RBAC: Company A admin calling PATCH /companies/:id/status receives 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .patch(`/companies/${companyBId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: CompanyStatus.SUSPENDED })
      .expect(403);
  });

  it('5. Status Update & Invalidation: PLATFORM_ADMIN suspends Company B and cache is invalidated', async () => {
    // Platform admin suspends Company B
    const patchRes = await request(app.getHttpServer())
      .patch(`/companies/${companyBId}/status`)
      .set('Authorization', `Bearer ${tokenPlatform}`)
      .send({ status: CompanyStatus.SUSPENDED })
      .expect(200);

    expect(patchRes.body.status).toBe(CompanyStatus.SUSPENDED);

    // Company B user's token is immediately rejected because Redis cache was invalidated and company is SUSPENDED!
    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    expect(meRes.body.message).toContain('Company account is suspended');
  });
});
