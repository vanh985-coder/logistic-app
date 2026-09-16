import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { CompanyType } from '@logix/shared';

describe('Authentication & Token Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testSuffix = Date.now().toString();
  const registrationPayload = {
    taxCode: `TAX-${testSuffix}`,
    companyName: `Test Company ${testSuffix}`,
    companyType: CompanyType.SHIPPER,
    representativeName: 'Nguyen Van A',
    email: `shipper_${testSuffix}@example.com`,
    password: 'SecurePassword123!',
    fullName: 'Nguyen Van A',
    phone: '0901234567',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup created test records
    try {
      const user = await prisma.unsafeGlobal.user.findUnique({
        where: { email: registrationPayload.email.toLowerCase() },
      });
      if (user) {
        await prisma.unsafeGlobal.company.delete({
          where: { id: user.companyId },
        });
      }
    } catch {
      // ignore
    }

    if (app) {
      await app.close();
    }
  });

  it('1. Register: should register company + admin user with Argon2id password hash', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registrationPayload)
      .expect(201);

    expect(res.body).toHaveProperty('company');
    expect(res.body).toHaveProperty('user');
    expect(res.body.company.taxCode).toBe(registrationPayload.taxCode);
    expect(res.body.user.email).toBe(registrationPayload.email.toLowerCase());
    expect(res.body.user.role).toBe('SHIPPER_ADMIN');

    // Verify raw password in DB is an Argon2id hash ($argon2id$...)
    const dbUser = await prisma.unsafeGlobal.user.findUnique({
      where: { email: registrationPayload.email.toLowerCase() },
    });
    expect(dbUser).toBeDefined();
    expect(dbUser!.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  let accessToken: string;
  let refreshTokenCookie: string;
  let rawRefreshTokenValue: string;

  it('2. Login: should authenticate user, return accessToken, and set HttpOnly refreshToken cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe(registrationPayload.email.toLowerCase());

    accessToken = res.body.accessToken;

    // Check Set-Cookie header
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(Array.isArray(cookies)).toBe(true);
    refreshTokenCookie = cookies.find((c: string) => c.includes('refreshToken='))!;
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain('HttpOnly');

    // Extract raw value for reuse testing
    const match = refreshTokenCookie.match(/refreshToken=([^;]+)/);
    rawRefreshTokenValue = match ? match[1] : '';
    expect(rawRefreshTokenValue).toBeTruthy();
  });

  it('3. Access Protected Route: /auth/me with Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(registrationPayload.email.toLowerCase());
    expect(res.body.company.taxCode).toBe(registrationPayload.taxCode);
  });

  let newAccessToken: string;
  let newRefreshTokenCookie: string;

  it('4. Refresh Token: should rotate token and return new accessToken and new cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [refreshTokenCookie])
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    newAccessToken = res.body.accessToken;
    expect(newAccessToken).not.toBe(accessToken);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    newRefreshTokenCookie = cookies.find((c: string) => c.includes('refreshToken='))!;
    expect(newRefreshTokenCookie).toBeDefined();
  });

  it('5. Reuse Detection: reusing old refreshToken after grace period should revoke family', async () => {
    // Wait for the 3-second grace period in Redis to expire
    await new Promise((resolve) => setTimeout(resolve, 3200));

    // Try to refresh with old rotated token
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${rawRefreshTokenValue}`])
      .expect(401);

    // The newly issued token should now also be rejected because the whole family was revoked!
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [newRefreshTokenCookie])
      .expect(401);
  });

  it('6. Logout: should revoke token and clear cookie', async () => {
    // Log in again to get fresh session
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .expect(200);

    const freshCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.includes('refreshToken='),
    )!;

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', [freshCookie])
      .expect(200);

    expect(logoutRes.body.success).toBe(true);

    // Cookie cleared
    const setCookie = logoutRes.headers['set-cookie'] as unknown as string[];
    const clearedCookie = setCookie.find((c) => c.includes('refreshToken=;'));
    expect(clearedCookie).toBeDefined();
  });
});
