import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import {
  CompanyType,
  CompanyStatus,
  UserRole,
  UserStatus,
  ShipmentStatus,
  MatchGroupStatus,
  QuoteStatus,
  BookingStatus,
} from '@logix/shared';

describe('Phase 6 Đợt 1 - FWD Quoting, Proportional Cost Allocation & Booking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  const testId = Date.now().toString();

  // FWD 1
  let tokenFwd1: string;
  let fwd1CompanyId: string;

  // FWD 2
  let tokenFwd2: string;
  let fwd2CompanyId: string;

  // Shipper 1 (in group)
  let tokenShipper1: string;
  let shipper1CompanyId: string;
  let shipment1Id: string;

  // Shipper 2 (in group)
  let tokenShipper2: string;
  let shipper2CompanyId: string;
  let shipment2Id: string;

  // Shipper 3 (outside group)
  let tokenShipper3: string;
  let shipper3CompanyId: string;

  let laneId: string;
  let containerTypeId: string;
  let matchGroupId: string;
  let createdQuoteId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);

    const defaultPassword = 'LogixDemo2026!';
    const passwordHash = await passwordService.hashPassword(defaultPassword);

    // 1. Create Lane
    const lane = await (prisma.unsafeGlobal as any).lane.upsert({
      where: { code: `SGN-HPH-QTEST-${testId}` },
      update: {},
      create: {
        code: `SGN-HPH-QTEST-${testId}`,
        name: 'Sài Gòn - Hải Phòng Test',
        origin: 'SGN',
        destination: 'HPH',
      },
    });
    laneId = lane.id;

    // 2. Create PricingConfig
    const pricingConfig = await (prisma.unsafeGlobal as any).pricingConfig.create({
      data: {
        laneId: lane.id,
        version: 1,
        cbmRate: 1_800_000n,
        weightRateKg: 4_500n,
        fixedFee: 50_000n,
      },
    });

    // 3. Create ContainerType (40HC)
    const container = await (prisma.unsafeGlobal as any).containerType.upsert({
      where: { code: `40HC-QTEST-${testId}` },
      update: {},
      create: {
        code: `40HC-QTEST-${testId}`,
        name: '40ft High Cube Container',
        innerLengthMm: 12032,
        innerWidthMm: 2352,
        innerHeightMm: 2698,
        volumeMm3: 76_400_000_000n, // ~76.4 CBM
        maxPayloadGram: 28_500_000n,
        tareWeightGram: 3_900_000n,
      },
    });
    containerTypeId = container.id;

    // 4. Helper to create company + user
    const createTenant = async (name: string, type: CompanyType, role: UserRole, emailPrefix: string) => {
      const company = await (prisma.unsafeGlobal as any).company.create({
        data: {
          taxCode: `TAX-${emailPrefix}-${testId}`,
          name,
          type,
          status: CompanyStatus.VERIFIED,
        },
      });
      const user = await (prisma.unsafeGlobal as any).user.create({
        data: {
          companyId: company.id,
          email: `${emailPrefix}_${testId}@logix.vn`,
          passwordHash,
          role,
          status: UserStatus.ACTIVE,
          fullName: `${name} Admin`,
        },
      });
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: defaultPassword })
        .expect(200);
      return { company, user, token: loginRes.body.accessToken };
    };

    const fwd1 = await createTenant('FWD VinaTrans', CompanyType.FWD, UserRole.FWD_ADMIN, 'fwd1');
    fwd1CompanyId = fwd1.company.id;
    tokenFwd1 = fwd1.token;

    const fwd2 = await createTenant('FWD Sotrans', CompanyType.FWD, UserRole.FWD_ADMIN, 'fwd2');
    fwd2CompanyId = fwd2.company.id;
    tokenFwd2 = fwd2.token;

    const shipper1 = await createTenant('Dệt may Phong Phú', CompanyType.SHIPPER, UserRole.SHIPPER_ADMIN, 'sh1');
    shipper1CompanyId = shipper1.company.id;
    tokenShipper1 = shipper1.token;

    const shipper2 = await createTenant('Điện tử Quang Trung', CompanyType.SHIPPER, UserRole.SHIPPER_ADMIN, 'sh2');
    shipper2CompanyId = shipper2.company.id;
    tokenShipper2 = shipper2.token;

    const shipper3 = await createTenant('Gỗ An Cường', CompanyType.SHIPPER, UserRole.SHIPPER_ADMIN, 'sh3');
    shipper3CompanyId = shipper3.company.id;
    tokenShipper3 = shipper3.token;

    // 5. Create Shipments for Shipper 1 and Shipper 2
    // Shipper 1: 30 CBM, base freight cost = 30,000,000 VND
    const s1 = await (prisma.unsafeGlobal as any).shipment.create({
      data: {
        companyId: shipper1CompanyId,
        laneId,
        pricingConfigId: pricingConfig.id,
        trackingCode: `TRK-SH1-${testId}`,
        status: ShipmentStatus.GROUPED,
        totalPackages: 10,
        volumeMm3: 30_000_000_000n,
        weightGrams: 5_000_000n,
        totalAmount: 30_000_000n,
      },
    });
    shipment1Id = s1.id;

    // Shipper 2: 20 CBM, base freight cost = 20,000,000 VND
    const s2 = await (prisma.unsafeGlobal as any).shipment.create({
      data: {
        companyId: shipper2CompanyId,
        laneId,
        pricingConfigId: pricingConfig.id,
        trackingCode: `TRK-SH2-${testId}`,
        status: ShipmentStatus.GROUPED,
        totalPackages: 8,
        volumeMm3: 20_000_000_000n,
        weightGrams: 4_000_000n,
        totalAmount: 20_000_000n,
      },
    });
    shipment2Id = s2.id;

    // 6. Create MatchGroup containing Shipments 1 & 2
    const mg = await (prisma.unsafeGlobal as any).matchGroup.create({
      data: {
        code: `MG-TEST-${testId}`,
        laneId,
        targetContainerTypeId: containerTypeId,
        status: MatchGroupStatus.PROPOSED,
        totalCbmMm3: 50_000_000_000n,
        totalWeightGrams: 9_000_000n,
        volumeFillBps: 6544, // ~65.4%
        weightFillBps: 3157,
        matchGroupShipments: {
          create: [
            { companyId: shipper1CompanyId, shipmentId: shipment1Id },
            { companyId: shipper2CompanyId, shipmentId: shipment2Id },
          ],
        },
      },
    });
    matchGroupId = mg.id;
  });

  afterAll(async () => {
    try {
      const companyIds = [
        shipper1CompanyId,
        shipper2CompanyId,
        shipper3CompanyId,
        fwd1CompanyId,
        fwd2CompanyId,
      ].filter(Boolean);

      if (companyIds.length > 0) {
        await prisma.unsafeGlobal.booking.deleteMany({
          where: {
            OR: [
              { fwdCompanyId: { in: companyIds } },
              { matchGroupId: matchGroupId || undefined },
            ],
          },
        });
        await prisma.unsafeGlobal.quote.deleteMany({
          where: {
            OR: [
              { fwdCompanyId: { in: companyIds } },
              { matchGroupId: matchGroupId || undefined },
            ],
          },
        });
        await prisma.unsafeGlobal.matchGroupShipment.deleteMany({
          where: {
            OR: [
              { companyId: { in: companyIds } },
              { matchGroupId: matchGroupId || undefined },
            ],
          },
        });
        if (matchGroupId) {
          await prisma.unsafeGlobal.matchGroup.deleteMany({
            where: { id: matchGroupId },
          });
        }
        await prisma.unsafeGlobal.package.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.unsafeGlobal.shipment.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.unsafeGlobal.refreshToken.deleteMany({
          where: { user: { companyId: { in: companyIds } } },
        });
        await prisma.unsafeGlobal.user.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.unsafeGlobal.company.deleteMany({
          where: { id: { in: companyIds } },
        });
      }
      if (laneId) {
        await prisma.unsafeGlobal.pricingConfig.deleteMany({ where: { laneId } });
        await prisma.unsafeGlobal.lane.deleteMany({ where: { id: laneId } });
      }
    } catch (e) {
      console.warn('Cleanup error in quote-booking e2e:', e);
    } finally {
      await app.close();
    }
  });

  describe('1. FWD Quote Creation & RBAC Guard', () => {
    it('should reject quote creation from a SHIPPER with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${tokenShipper1}`)
        .send({
          matchGroupId,
          oceanFreight: 20_000_000,
          handlingFee: 2_000_000,
          documentationFee: 500_000,
          surcharges: 500_000,
          transitDays: 3,
          validUntil: new Date(Date.now() + 86400000 * 3).toISOString(),
        })
        .expect(403);
    });

    it('should allow FWD 1 to submit a container quote with proportional allocation calculated', async () => {
      // Subtotal = 25M + 2M + 500k + 500k = 28M VND
      // VAT 10% = 2.8M VND
      // Total = 30.8M VND
      const res = await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${tokenFwd1}`)
        .send({
          matchGroupId,
          oceanFreight: 25_000_000,
          handlingFee: 2_000_000,
          documentationFee: 500_000,
          surcharges: 500_000,
          vatRateBps: 1000,
          transitDays: 3,
          validUntil: new Date(Date.now() + 86400000 * 3).toISOString(),
          notes: 'Standard 40HC dry cargo quote',
        })
        .expect(201);

      createdQuoteId = res.body.id;
      expect(createdQuoteId).toBeDefined();
      expect(res.body.status).toBe(QuoteStatus.PENDING);
      expect(res.body.oceanFreight).toBe('25000000');
      expect(res.body.vatAmount).toBe('2800000');
      expect(res.body.totalAmount).toBe('30800000');

      // Proportional allocation: Shipper 1 has 30M / 50M = 60%, Shipper 2 has 20M / 50M = 40%
      expect(res.body.allocations).toHaveLength(2);

      const alloc1 = res.body.allocations.find((a: any) => a.companyId === shipper1CompanyId);
      const alloc2 = res.body.allocations.find((a: any) => a.companyId === shipper2CompanyId);

      expect(alloc1).toBeDefined();
      expect(alloc2).toBeDefined();

      expect(alloc1.costSharePercent).toBe(60);
      expect(alloc2.costSharePercent).toBe(40);

      // 60% of 30,800,000 = 18,480,000
      // 40% of 30,800,000 = 12,320,000
      expect(alloc1.allocatedAmount).toBe('18480000');
      expect(alloc2.allocatedAmount).toBe('12320000');

      // Exact sum test: 18,480,000 + 12,320,000 = 30,800,000
      const sum = BigInt(alloc1.allocatedAmount) + BigInt(alloc2.allocatedAmount);
      expect(sum.toString()).toBe('30800000');
    });
  });

  describe('2. Multi-Tenant Isolation & IDOR Protection for Quotes (findMany AND findUnique)', () => {
    it('findMany: FWD 1 can view their own quote', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quotes?matchGroupId=${matchGroupId}`)
        .set('Authorization', `Bearer ${tokenFwd1}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(createdQuoteId);
    });

    it('findMany: FWD 2 CANNOT view FWD 1 quote (returns empty array)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quotes?matchGroupId=${matchGroupId}`)
        .set('Authorization', `Bearer ${tokenFwd2}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('findMany: Shipper 1 can view quotes for their match group with myAllocation populated', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quotes?matchGroupId=${matchGroupId}`)
        .set('Authorization', `Bearer ${tokenShipper1}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(createdQuoteId);
      expect(res.body[0].myAllocation).toBeDefined();
      expect(res.body[0].myAllocation.allocatedAmount).toBe('18480000');
    });

    it('findMany: Shipper 3 (outside group) CANNOT view quotes for this match group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quotes?matchGroupId=${matchGroupId}`)
        .set('Authorization', `Bearer ${tokenShipper3}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('findUnique (IDOR Defense): FWD 1 can retrieve their quote by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quotes/${createdQuoteId}`)
        .set('Authorization', `Bearer ${tokenFwd1}`)
        .expect(200);

      expect(res.body.id).toBe(createdQuoteId);
    });

    it('findUnique (IDOR Defense): FWD 2 is BLOCKED with 404 when querying FWD 1 quote by ID', async () => {
      await request(app.getHttpServer())
        .get(`/quotes/${createdQuoteId}`)
        .set('Authorization', `Bearer ${tokenFwd2}`)
        .expect(404);
    });

    it('findUnique (IDOR Defense): Shipper 1 can retrieve quote for their match group by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quotes/${createdQuoteId}`)
        .set('Authorization', `Bearer ${tokenShipper1}`)
        .expect(200);

      expect(res.body.id).toBe(createdQuoteId);
      expect(res.body.myAllocation.allocatedAmount).toBe('18480000');
    });

    it('findUnique (IDOR Defense): Shipper 3 is BLOCKED with 404 when querying quote by ID', async () => {
      await request(app.getHttpServer())
        .get(`/quotes/${createdQuoteId}`)
        .set('Authorization', `Bearer ${tokenShipper3}`)
        .expect(404);
    });
  });

  describe('3. Booking Confirmation & State Transitions', () => {
    it('should reject booking confirmation from FWD 2 (who did not submit the quote)', async () => {
      await request(app.getHttpServer())
        .post(`/quotes/${createdQuoteId}/accept-booking`)
        .set('Authorization', `Bearer ${tokenFwd2}`)
        .expect(404);
    });

    it('should allow FWD 1 to confirm booking on accepted quote', async () => {
      const res = await request(app.getHttpServer())
        .post(`/quotes/${createdQuoteId}/accept-booking`)
        .set('Authorization', `Bearer ${tokenFwd1}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.bookingNumber).toMatch(/^BKG\d+/);
      expect(res.body.booking.status).toBe(BookingStatus.CONFIRMED);

      // Verify MatchGroup status transitioned to CONFIRMED
      const mgDb = await (prisma.unsafeGlobal as any).matchGroup.findUnique({
        where: { id: matchGroupId },
      });
      expect(mgDb.status).toBe(MatchGroupStatus.CONFIRMED);

      // Verify Shipments transitioned to CONFIRMED
      const s1Db = await (prisma.unsafeGlobal as any).shipment.findUnique({
        where: { id: shipment1Id },
      });
      const s2Db = await (prisma.unsafeGlobal as any).shipment.findUnique({
        where: { id: shipment2Id },
      });
      expect(s1Db.status).toBe(ShipmentStatus.CONFIRMED);
      expect(s2Db.status).toBe(ShipmentStatus.CONFIRMED);
    });
  });

  describe('4. Shipper Withdrawal ("Tách khỏi nhóm")', () => {
    it('should prevent Shipper 3 from withdrawing Shipper 1 shipment with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post(`/match-groups/${matchGroupId}/shipments/${shipment1Id}/withdraw`)
        .set('Authorization', `Bearer ${tokenShipper3}`)
        .expect(403);
    });

    it('should allow Shipper 1 to withdraw their shipment and return it to SUBMITTED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/match-groups/${matchGroupId}/shipments/${shipment1Id}/withdraw`)
        .set('Authorization', `Bearer ${tokenShipper1}`)
        .expect(201);

      expect(res.body.success).toBe(true);

      // Shipment 1 status is reset to SUBMITTED
      const s1Db = await (prisma.unsafeGlobal as any).shipment.findUnique({
        where: { id: shipment1Id },
      });
      expect(s1Db.status).toBe(ShipmentStatus.SUBMITTED);

      // MatchGroup remains with Shipper 2 shipment only, metrics updated
      const mgDb = await (prisma.unsafeGlobal as any).matchGroup.findUnique({
        where: { id: matchGroupId },
        include: { matchGroupShipments: true },
      });
      expect(mgDb.matchGroupShipments).toHaveLength(1);
      expect(mgDb.matchGroupShipments[0].shipmentId).toBe(shipment2Id);
      expect(mgDb.totalCbmMm3.toString()).toBe('20000000000'); // 20 CBM
    });
  });

  describe('5. FWD Dashboard Metrics Aggregation', () => {
    it('should return aggregated real-time metrics for FWD 1', async () => {
      const res = await request(app.getHttpServer())
        .get('/match-groups/fwd-metrics')
        .set('Authorization', `Bearer ${tokenFwd1}`)
        .expect(200);

      expect(res.body.availableGroupsCount).toBeDefined();
      expect(res.body.myQuotesCount).toBeGreaterThanOrEqual(1);
      expect(res.body.activeBookingsCount).toBeGreaterThanOrEqual(1);
      expect(res.body.totalCbmConsolidated).toBeDefined();
    });
  });

  describe('6. Empty MatchGroup Confirmation Guards', () => {
    let emptyMgId: string;

    beforeAll(async () => {
      // Create an empty match group with 0 shipments
      const emptyMg = await prisma.unsafeGlobal.matchGroup.create({
        data: {
          code: `MG-EMPTY-${testId}`,
          laneId,
          targetContainerTypeId: containerTypeId,
          status: MatchGroupStatus.PROPOSED,
          totalCbmMm3: 0n,
          totalWeightGrams: 0n,
          volumeFillBps: 0,
          weightFillBps: 0,
        },
      });
      emptyMgId = emptyMg.id;
    });

    afterAll(async () => {
      if (emptyMgId) {
        await prisma.unsafeGlobal.quote.deleteMany({ where: { matchGroupId: emptyMgId } });
        await prisma.unsafeGlobal.matchGroup.deleteMany({ where: { id: emptyMgId } });
      }
    });

    it('should reject confirmMatchGroup on an empty match group (0 shipments) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/match-groups/${emptyMgId}/confirm`)
        .set('Authorization', `Bearer ${tokenFwd1}`)
        .expect(400);

      expect(res.body.message).toContain('không có lô hàng nào');
    });

    it('should reject acceptBooking on an empty match group with 400 Bad Request', async () => {
      // Create a quote on this empty group
      const quote = await prisma.unsafeGlobal.quote.create({
        data: {
          matchGroupId: emptyMgId,
          fwdCompanyId: fwd1CompanyId,
          status: QuoteStatus.PENDING,
          oceanFreight: 20_000_000n,
          handlingFee: 2_000_000n,
          documentationFee: 500_000n,
          surcharges: 500_000n,
          vatRateBps: 1000,
          vatAmount: 2_300_000n,
          totalAmount: 25_300_000n,
          transitDays: 3,
          validUntil: new Date(Date.now() + 86400000),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/quotes/${quote.id}/accept-booking`)
        .set('Authorization', `Bearer ${tokenFwd1}`)
        .expect(400);

      expect(res.body.message).toContain('không có lô hàng nào');
    });
  });
});
