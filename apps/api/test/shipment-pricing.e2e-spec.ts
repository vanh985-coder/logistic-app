import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as xlsx from 'xlsx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { CompanyType, CompanyStatus, UserRole, UserStatus } from '@logix/shared';

// Support BigInt JSON serialization in tests
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

describe('Shipment & Pricing Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  const testId = Date.now().toString();

  let tokenA: string;
  let tokenB: string;
  let tokenPlatform: string;

  let laneId: string;
  let shipmentAId: string;

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
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taxCode: `TAX-SHP-A-${testId}`,
        companyName: `Shipper Alpha ${testId}`,
        companyType: CompanyType.SHIPPER,
        email: `shipper_a_${testId}@example.com`,
        password: 'Password123!',
        fullName: 'Shipper A Admin',
      })
      .expect(201);

    // 2. Register Company B
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taxCode: `TAX-SHP-B-${testId}`,
        companyName: `Shipper Beta ${testId}`,
        companyType: CompanyType.SHIPPER,
        email: `shipper_b_${testId}@example.com`,
        password: 'Password123!',
        fullName: 'Shipper B Admin',
      })
      .expect(201);

    // 3. Create Platform Admin using unsafeGlobal
    const platformPassHash = await passwordService.hashPassword('PlatformAdmin123!');
    const platformCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-PLATFORM-SHP-${testId}`,
        name: `Platform Ops ${testId}`,
        type: CompanyType.FWD,
        status: CompanyStatus.VERIFIED,
      },
    });

    await prisma.unsafeGlobal.user.create({
      data: {
        companyId: platformCompany.id,
        email: `platform_shp_${testId}@logix.internal`,
        passwordHash: platformPassHash,
        role: UserRole.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
        fullName: 'Platform Ops Admin',
      },
    });

    // 4. Log in
    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `shipper_a_${testId}@example.com`, password: 'Password123!' })
      .expect(200);
    tokenA = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `shipper_b_${testId}@example.com`, password: 'Password123!' })
      .expect(200);
    tokenB = loginB.body.accessToken;

    const loginPlatform = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `platform_shp_${testId}@logix.internal`, password: 'PlatformAdmin123!' })
      .expect(200);
    tokenPlatform = loginPlatform.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Lane & PricingConfig Versioning', () => {
    it('should reject non-admin from creating a lane (HTTP 403)', async () => {
      await request(app.getHttpServer())
        .post('/lanes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          code: `LANE-${testId}`,
          name: 'Test Lane',
          origin: 'SGN',
          destination: 'HPH',
          cbmRate: 2000000,
          weightRateKg: 5000,
        })
        .expect(403);
    });

    it('should allow PLATFORM_ADMIN to create a lane with initial pricing config (v1)', async () => {
      const res = await request(app.getHttpServer())
        .post('/lanes')
        .set('Authorization', `Bearer ${tokenPlatform}`)
        .send({
          code: `LANE-${testId}`,
          name: 'Sài Gòn - Hải Phòng',
          origin: 'SGN',
          destination: 'HPH',
          cbmRate: 2000000,
          weightRateKg: 5000,
          fixedFee: 50000,
          standardSurchargeBps: 10000,
          irregularSurchargeBps: 11500,
          noStackSurchargeBps: 13000,
          maxEdgeRatioThreshold: 5,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBe(`LANE-${testId}`);
      expect(res.body.currentPricingConfig).toBeDefined();
      expect(res.body.currentPricingConfig.version).toBe(1);
      expect(res.body.currentPricingConfig.effectiveTo).toBeNull();

      laneId = res.body.id;
    });

    it('should create a new pricing config version (v2) and set effectiveTo on v1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/lanes/${laneId}/pricing-configs`)
        .set('Authorization', `Bearer ${tokenPlatform}`)
        .send({
          cbmRate: 2500000,
          weightRateKg: 6000,
          fixedFee: 60000,
          standardSurchargeBps: 10000,
          irregularSurchargeBps: 11500,
          noStackSurchargeBps: 13000,
          maxEdgeRatioThreshold: 5,
        })
        .expect(201);

      expect(res.body.version).toBe(2);
      expect(res.body.effectiveTo).toBeNull();

      // Verify lane details does NOT expose historical pricingConfigs
      const laneDetails = await request(app.getHttpServer())
        .get(`/lanes/${laneId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(laneDetails.body.currentPricingConfig.version).toBe(2);
      expect(laneDetails.body.pricingConfigs).toBeUndefined();

      // Verify non-admin CANNOT view pricing history (403)
      await request(app.getHttpServer())
        .get(`/lanes/${laneId}/pricing-history`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);

      // Verify PLATFORM_ADMIN CAN view pricing history (200)
      const history = await request(app.getHttpServer())
        .get(`/lanes/${laneId}/pricing-history`)
        .set('Authorization', `Bearer ${tokenPlatform}`)
        .expect(200);

      expect(history.body.length).toBe(2);
      const v1 = history.body.find((pc: any) => pc.version === 1);
      expect(v1.effectiveTo).not.toBeNull();
    });

    it('should prevent inserting two active pricing configs via partial unique index', async () => {
      await expect(
        prisma.unsafeGlobal.pricingConfig.create({
          data: {
            laneId,
            version: 999,
            cbmRate: 1000000n,
            weightRateKg: 1000n,
            fixedFee: 0n,
            effectiveTo: null, // violates partial index because v2 has effectiveTo = null
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('2. Multi-Tenant Shipment Creation & Isolation', () => {
    it('Company A should create a draft shipment on lane', async () => {
      const res = await request(app.getHttpServer())
        .post('/shipments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ laneId })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.trackingCode).toMatch(/^SHP-/);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.totalPackages).toBe(0);

      shipmentAId = res.body.id;
    });

    it('Company B CANNOT view Company A shipment (HTTP 404)', async () => {
      await request(app.getHttpServer())
        .get(`/shipments/${shipmentAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('Company B CANNOT add packages to Company A shipment (HTTP 404)', async () => {
      await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/packages`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          packageCode: 'PKG-HACK',
          lengthMm: 500,
          widthMm: 500,
          heightMm: 500,
          weightGrams: 5000,
        })
        .expect(404);
    });

    it('Company B list shipments should return empty (no leakage of Company A)', async () => {
      const res = await request(app.getHttpServer())
        .get('/shipments')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body.items.length).toBe(0);
    });
  });

  describe('3. Package Management, Hg Surcharges & Exact VNĐ Math', () => {
    let pkg1Id: string;

    it('should add a standard package and transition status to PRICED with Hg=1.00', async () => {
      // 1 CBM (1000x1000x1000 mm), 100kg (100,000g)
      // v2 cbmRate: 2,500,000 VND / m3
      // v2 weightRateKg: 6,000 VND / kg
      // Volume = 2,500,000; Weight = 100 * 6,000 = 600,000 -> VOLUME wins
      // Hg = 1.00 (Standard)
      // Fixed fee = 60,000 -> Total = 2,560,000 VND
      const res = await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/packages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          packageCode: 'PKG-BOX-1',
          lengthMm: 1000,
          widthMm: 1000,
          heightMm: 1000,
          weightGrams: 100000,
          isFragile: false,
          noStack: false,
        })
        .expect(201);

      expect(res.body.status).toBe('PRICED');
      expect(res.body.totalPackages).toBe(1);
      expect(res.body.chargeableBasis).toBe('VOLUME');
      expect(res.body.pricingSnapshot.hgFactorBps).toBe(10000);
      expect(res.body.pricingSnapshot.hgReason).toBe('STANDARD');
      expect(res.body.totalAmount).toBe('2560000');

      pkg1Id = res.body.packages[0].id;
    });

    it('should add a noStack package and increase Hg to 1.30 (Conflict resolution to max Hg)', async () => {
      // Add noStack package: 500x500x500 mm (0.125 CBM), 50kg (50,000g)
      // Total volume: 1.125 CBM -> 1.125 * 2,500,000 = 2,812,500 VND
      // Total weight: 150 kg -> 150 * 6,000 = 900,000 VND
      // Winning: VOLUME (2,812,500 VND)
      // Hg: max(10000, 13000) = 13000 (1.30)
      // Surcharged = roundDiv(2812500 * 13000, 10000) = 3,656,250 VND
      // Surcharge fee = 3656250 - 2812500 = 843,750 VND
      // Total = 3,656,250 + 60,000 = 3,716,250 VND
      const res = await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/packages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          packageCode: 'PKG-NO-STACK',
          lengthMm: 500,
          widthMm: 500,
          heightMm: 500,
          weightGrams: 50000,
          isFragile: false,
          noStack: true,
        })
        .expect(201);

      expect(res.body.totalPackages).toBe(2);
      expect(res.body.pricingSnapshot.hgFactorBps).toBe(13000);
      expect(res.body.pricingSnapshot.hgReason).toBe('NO_STACK');
      expect(res.body.totalAmount).toBe('3716250');
    });

    it('should delete package and recalculate pricing', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/shipments/${shipmentAId}/packages/${pkg1Id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.totalPackages).toBe(1);
      expect(res.body.packages[0].packageCode).toBe('PKG-NO-STACK');
    });

    it('should add multiple packages via POST /shipments/:id/packages/batch in a single call', async () => {
      const res = await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/packages/batch`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          packages: [
            {
              packageCode: 'PKG-BATCH-1',
              lengthMm: 500,
              widthMm: 400,
              heightMm: 300,
              weightGrams: 8000,
            },
            {
              packageCode: 'PKG-BATCH-2',
              lengthMm: 600,
              widthMm: 500,
              heightMm: 400,
              weightGrams: 15000,
              isFragile: true,
            },
          ],
        })
        .expect(201);

      expect(res.body.packages.some((p: any) => p.packageCode === 'PKG-BATCH-1')).toBe(true);
      expect(res.body.packages.some((p: any) => p.packageCode === 'PKG-BATCH-2')).toBe(true);
      expect(res.body.totalPackages).toBe(3); // 1 previous + 2 batch
    });
  });

  describe('4. Excel Import with Row-by-Row Error Reporting', () => {
    it('should return 422 with exact row numbers and error descriptions for invalid Excel', async () => {
      const rows = [
        ['packageCode', 'lengthMm', 'widthMm', 'heightMm', 'weightGrams', 'isFragile', 'noStack'],
        ['', 400, 300, 200, 5000, false, false], // Row 2: empty code
        ['PKG-BAD-LEN', -50, 300, 200, 5000, false, false], // Row 3: negative length
      ];

      const ws = xlsx.utils.aoa_to_sheet(rows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Packages');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const res = await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/packages/import-excel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', buffer, 'invalid_packages.xlsx')
        .expect(422);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBe(2);
      expect(res.body.errors[0].row).toBe(2);
      expect(res.body.errors[0].column).toBe('packageCode');
      expect(res.body.errors[1].row).toBe(3);
      expect(res.body.errors[1].column).toBe('lengthMm');
    });

    it('should successfully import valid Excel packages and recalculate shipment', async () => {
      const rows = [
        ['packageCode', 'lengthMm', 'widthMm', 'heightMm', 'weightGrams', 'isFragile', 'noStack', 'packageType'],
        ['PKG-EXCEL-1', 600, 400, 300, 12000, false, false, 'BOX'],
        ['PKG-EXCEL-2', 1200, 800, 1000, 45000, false, false, 'PALLET'],
      ];

      const ws = xlsx.utils.aoa_to_sheet(rows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Packages');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const res = await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/packages/import-excel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', buffer, 'valid_packages.xlsx')
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.importedCount).toBe(2);
      expect(res.body.shipment.totalPackages).toBe(5); // 3 previous + 2 new
    });
  });

  describe('5. Shipment Submission', () => {
    it('should submit shipment and change status to SUBMITTED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/submit`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      expect(res.body.status).toBe('SUBMITTED');
    });

    it('should disallow adding packages to a SUBMITTED shipment', async () => {
      await request(app.getHttpServer())
        .post(`/shipments/${shipmentAId}/packages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          packageCode: 'PKG-AFTER-SUBMIT',
          lengthMm: 400,
          widthMm: 300,
          heightMm: 200,
          weightGrams: 5000,
        })
        .expect(400);
    });
  });
});
