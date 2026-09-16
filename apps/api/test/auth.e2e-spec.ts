import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
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

  it('1. Register: should register company + admin user and strip sensitive fields (taxCode, status, timestamps)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registrationPayload)
      .expect(201);

    expect(res.body).toHaveProperty('company');
    expect(res.body).toHaveProperty('user');
    expect(res.body.company.name).toBe(registrationPayload.companyName);
    expect(res.body.user.email).toBe(registrationPayload.email.toLowerCase());
    expect(res.body.user.role).toBe('SHIPPER_ADMIN');

    // Security check: Verify sensitive internal fields are NOT leaked in response
    expect(res.body.company.taxCode).toBeUndefined();
    expect(res.body.company.status).toBeUndefined();
    expect(res.body.company.createdAt).toBeUndefined();
    expect(res.body.user.status).toBeUndefined();
    expect(res.body.user.createdAt).toBeUndefined();

    // Verify raw password in DB is an Argon2id hash ($argon2id$...)
    const dbUser = await prisma.unsafeGlobal.user.findUnique({
      where: { email: registrationPayload.email.toLowerCase() },
    });
    expect(dbUser).toBeDefined();
    expect(dbUser!.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('2. Anti-Timing & User Enumeration: invalid email vs wrong password return identical generic error', async () => {
    // Attempt login with non-existent email
    const nonExistentRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `non_existent_${Date.now()}@example.com`,
        password: 'AnyPassword123!',
      })
      .expect(401);

    // Attempt login with existing email but wrong password
    const wrongPasswordRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: registrationPayload.email,
        password: 'WrongPassword999!',
      })
      .expect(401);

    // Both responses must be byte-for-byte identical to eliminate user enumeration
    expect(nonExistentRes.body).toEqual({
      statusCode: 401,
      message: 'Invalid email or password',
      error: 'Unauthorized',
    });
    expect(wrongPasswordRes.body).toEqual(nonExistentRes.body);
  });

  let accessToken: string;
  let refreshTokenCookie: string;
  let rawRefreshTokenValue: string;

  it('3. Login: should authenticate user, return accessToken, and strip companyStatus from user payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: registrationPayload.email,
        password: registrationPayload.password,
      })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe(registrationPayload.email.toLowerCase());
    expect(res.body.user.companyName).toBe(registrationPayload.companyName);

    // Security & DTO check: tokens wrapper must NOT exist, response must be strictly flat
    expect(res.body).not.toHaveProperty('tokens');
    expect(res.body.tokens).toBeUndefined();
    expect(Object.keys(res.body).sort()).toEqual(['accessToken', 'user'].sort());

    // Verify accessToken key appears exactly once in the entire JSON string
    const accessTokenOccurrences = (JSON.stringify(res.body).match(/"accessToken"/g) || []).length;
    expect(accessTokenOccurrences).toBe(1);

    // Security check: companyStatus is not exposed
    expect(res.body.user.companyStatus).toBeUndefined();

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

  it('4. Access Protected Route: /auth/me returns profile and strips taxCode, lastLoginAt, status', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(registrationPayload.email.toLowerCase());
    expect(res.body.company.name).toBe(registrationPayload.companyName);

    // Security check: ensure sensitive tracking fields are omitted
    expect(res.body.company.taxCode).toBeUndefined();
    expect(res.body.company.status).toBeUndefined();
    expect(res.body.lastLoginAt).toBeUndefined();
    expect(res.body.status).toBeUndefined();
  });

  let newAccessToken: string;
  let newRefreshTokenCookie: string;

  it('5. Refresh Token: should rotate token and return new accessToken and new cookie', async () => {
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

  it('6. Reuse Detection: should return generic 401 (OAuth 2.0 BCP) and log security alert on server', async () => {
    // Spy on server error logging to verify detailed audit context is recorded
    const errorLogSpy = jest.spyOn(Logger.prototype, 'error');

    // Wait for the 3-second grace period in Redis to expire
    await new Promise((resolve) => setTimeout(resolve, 3200));

    // Try to refresh with old rotated token
    const resReuse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${rawRefreshTokenValue}`])
      .expect(401);

    // OAuth 2.0 Security BCP: Response must be generic and NOT reveal defense mechanisms
    expect(resReuse.body.message).toBe('Invalid or expired session');
    expect(resReuse.body.message).not.toContain('reuse');
    expect(resReuse.body.message).not.toContain('family');

    // Verify that server logger recorded the detailed security alert
    expect(errorLogSpy).toHaveBeenCalled();
    const alertCall = errorLogSpy.mock.calls.find((call) =>
      typeof call[0] === 'object' &&
      call[0]?.msg?.includes('Refresh token reuse detected'),
    );
    expect(alertCall).toBeDefined();
    expect(alertCall![0]).toHaveProperty('familyId');
    expect(alertCall![0]).toHaveProperty('userId');

    errorLogSpy.mockRestore();

    // The newly issued token in the family must also now fail with generic 401
    const resRevokedFamily = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [newRefreshTokenCookie])
      .expect(401);

    expect(resRevokedFamily.body.message).toBe('Invalid or expired session');
  });

  it('7. Logout: should revoke token and clear cookie', async () => {
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
