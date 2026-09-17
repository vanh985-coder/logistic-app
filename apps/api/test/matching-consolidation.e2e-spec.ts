import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { CompanyType, CompanyStatus, UserRole, UserStatus, MatchGroupStatus, ShipmentStatus } from '@logix/shared';

// Support BigInt JSON serialization in tests
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

describe('Phase 3: Matching Engine & Consolidation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  const testId = Date.now().toString();

  let tokenShipperA: string;
  let companyAId: string;
  let tokenShipperB: string;
  let tokenShipperGamma: string;
  let tokenFwd: string;
  let companyFwdId: string;
  let tokenPlatform: string;

  let laneId: string;
  let otherLaneId: string;
  let pricingConfigId: string;
  let container20DCId: string;

  let shipmentA1Id: string;
  let trackingCodeA: string;
  let shipmentB1Id: string;
  let trackingCodeB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);

    // 1. Register & Login Shipper Alpha
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taxCode: `TAX-SHP-A-${testId}`,
        companyName: `Shipper Alpha Corp ${testId}`,
        companyType: CompanyType.SHIPPER,
        email: `shipper_a_${testId}@example.com`,
        password: 'Password123!',
        fullName: 'Shipper Alpha Manager',
      })
      .expect(201);

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `shipper_a_${testId}@example.com`, password: 'Password123!' })
      .expect(200);
    tokenShipperA = loginA.body.accessToken;
    companyAId = loginA.body.user.companyId;

    // 2. Register & Login Shipper Beta
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taxCode: `TAX-SHP-B-${testId}`,
        companyName: `Shipper Beta Corp ${testId}`,
        companyType: CompanyType.SHIPPER,
        email: `shipper_b_${testId}@example.com`,
        password: 'Password123!',
        fullName: 'Shipper Beta Manager',
      })
      .expect(201);

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `shipper_b_${testId}@example.com`, password: 'Password123!' })
      .expect(200);
    tokenShipperB = loginB.body.accessToken;

    // 3. Register & Login Shipper Gamma (outsider shipper)
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taxCode: `TAX-SHP-G-${testId}`,
        companyName: `Shipper Gamma Corp ${testId}`,
        companyType: CompanyType.SHIPPER,
        email: `shipper_g_${testId}@example.com`,
        password: 'Password123!',
        fullName: 'Shipper Gamma Manager',
      })
      .expect(201);

    const loginGamma = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `shipper_g_${testId}@example.com`, password: 'Password123!' })
      .expect(200);
    tokenShipperGamma = loginGamma.body.accessToken;

    // 4. Register Forwarder Delta
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taxCode: `TAX-FWD-D-${testId}`,
        companyName: `Forwarder Delta Logistics ${testId}`,
        companyType: CompanyType.FWD,
        email: `fwd_delta_${testId}@example.com`,
        password: 'Password123!',
        fullName: 'Forwarder Delta Dispatcher',
      })
      .expect(201);

    const initialLoginFwd = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `fwd_delta_${testId}@example.com`, password: 'Password123!' })
      .expect(200);
    companyFwdId = initialLoginFwd.body.user.companyId;

    // Upgrade FWD user to FWD_ADMIN
    await prisma.unsafeGlobal.user.update({
      where: { email: `fwd_delta_${testId}@example.com` },
      data: { role: UserRole.FWD_ADMIN },
    });
    // Invalidate tenant cache to pick up FWD_ADMIN role
    await prisma.unsafeGlobal.company.update({
      where: { id: companyFwdId },
      data: { status: CompanyStatus.VERIFIED },
    });

    // Re-login to get updated role token
    const loginFwd = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `fwd_delta_${testId}@example.com`, password: 'Password123!' })
      .expect(200);
    tokenFwd = loginFwd.body.accessToken;

    // 5. Create Platform Admin
    const platformPassHash = await passwordService.hashPassword('PlatformAdmin123!');
    const platformCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-PLATFORM-MATCH-${testId}`,
        name: `Platform Ops Matching ${testId}`,
        type: CompanyType.FWD,
        status: CompanyStatus.VERIFIED,
      },
    });

    await prisma.unsafeGlobal.user.create({
      data: {
        companyId: platformCompany.id,
        email: `platform_match_${testId}@logix.internal`,
        passwordHash: platformPassHash,
        role: UserRole.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
        fullName: 'Platform Ops Admin',
      },
    });

    const loginPlatform = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `platform_match_${testId}@logix.internal`, password: 'PlatformAdmin123!' })
      .expect(200);
    tokenPlatform = loginPlatform.body.accessToken;

    // 6. Setup Lanes and Pricing
    const laneRes = await request(app.getHttpServer())
      .post('/lanes')
      .set('Authorization', `Bearer ${tokenPlatform}`)
      .send({
        code: `LANE-MATCH-${testId}`,
        name: `Hải Phòng - Singapore Consol ${testId}`,
        origin: 'VNHPH',
        destination: 'SGSIN',
        cbmRate: 1500000,
        weightRateKg: 1000,
        fixedFee: 500000,
      })
      .expect(201);
    laneId = laneRes.body.id;
    pricingConfigId = laneRes.body.currentPricingConfig.id;

    // Second lane for isolation testing
    const otherLaneRes = await request(app.getHttpServer())
      .post('/lanes')
      .set('Authorization', `Bearer ${tokenPlatform}`)
      .send({
        code: `LANE-OTHER-${testId}`,
        name: `Hải Phòng - Busan ${testId}`,
        origin: 'VNHPH',
        destination: 'KRPUS',
        cbmRate: 1800000,
        weightRateKg: 1200,
      })
      .expect(201);
    otherLaneId = otherLaneRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Container Types Master Data', () => {
    it('should have standard containers auto-seeded and accessible via GET /containers', async () => {
      const res = await request(app.getHttpServer())
        .get('/containers')
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      const codes = res.body.map((c: any) => c.code);
      expect(codes).toContain('20DC');
      expect(codes).toContain('40DC');
      expect(codes).toContain('40HC');

      const c20 = res.body.find((c: any) => c.code === '20DC');
      container20DCId = c20.id;
      expect(c20.innerLengthMm).toBe(5898);
      expect(c20.innerWidthMm).toBe(2352);
      expect(c20.innerHeightMm).toBe(2393);
      expect(Number(c20.maxPayloadKg)).toBe(28200);
      expect(Number(c20.volumeCbm)).toBeGreaterThan(33);
    });
  });

  describe('2. Shipment Preparation & Submission', () => {
    it('should create and submit Shipment 1 for Shipper Alpha (10 CBM, 4,000 kg)', async () => {
      // Create shipment
      const createRes = await request(app.getHttpServer())
        .post('/shipments')
        .set('Authorization', `Bearer ${tokenShipperA}`)
        .send({
          laneId,
          pricingConfigId,
        })
        .expect(201);
      shipmentA1Id = createRes.body.id;
      trackingCodeA = createRes.body.trackingCode;

      // Add packages: 10 boxes of 1000x1000x1000 mm, 400 kg each = 10 CBM, 4000 kg
      for (let i = 1; i <= 10; i++) {
        await request(app.getHttpServer())
          .post(`/shipments/${shipmentA1Id}/packages`)
          .set('Authorization', `Bearer ${tokenShipperA}`)
          .send({
            packageCode: `BOX-A-${i}`,
            lengthMm: 1000,
            widthMm: 1000,
            heightMm: 1000,
            weightGrams: 400000,
          })
          .expect(201);
      }

      // Submit shipment
      const submitRes = await request(app.getHttpServer())
        .post(`/shipments/${shipmentA1Id}/submit`)
        .set('Authorization', `Bearer ${tokenShipperA}`)
        .expect(201);

      expect(submitRes.body.status).toBe(ShipmentStatus.SUBMITTED);
    });

    it('should create and submit Shipment 2 for Shipper Beta (12 CBM, 5,000 kg)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/shipments')
        .set('Authorization', `Bearer ${tokenShipperB}`)
        .send({
          laneId,
          pricingConfigId,
        })
        .expect(201);
      shipmentB1Id = createRes.body.id;
      trackingCodeB = createRes.body.trackingCode;

      // Add packages: 12 boxes of 1000x1000x1000 mm, 416.66 kg each ~ 5000 kg total
      for (let i = 1; i <= 12; i++) {
        await request(app.getHttpServer())
          .post(`/shipments/${shipmentB1Id}/packages`)
          .set('Authorization', `Bearer ${tokenShipperB}`)
          .send({
            packageCode: `BOX-B-${i}`,
            lengthMm: 1000,
            widthMm: 1000,
            heightMm: 1000,
            weightGrams: 416666,
          })
          .expect(201);
      }

      const submitRes = await request(app.getHttpServer())
        .post(`/shipments/${shipmentB1Id}/submit`)
        .set('Authorization', `Bearer ${tokenShipperB}`)
        .expect(201);

      expect(submitRes.body.status).toBe(ShipmentStatus.SUBMITTED);
    });

    it('should list unassigned submitted shipments for the lane', async () => {
      const res = await request(app.getHttpServer())
        .get(`/match-groups/unassigned-shipments?laneId=${laneId}`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const trackingCodes = res.body.map((s: any) => s.trackingCode);
      expect(trackingCodes).toContain(trackingCodeA);
      expect(trackingCodes).toContain(trackingCodeB);
    });
  });

  describe('3. Matching Engine Automatic Proposal', () => {
    let proposedGroupId: string;

    it('should reject non-forwarder/non-admin from triggering matching proposal (HTTP 403)', async () => {
      await request(app.getHttpServer())
        .post('/match-groups/propose')
        .set('Authorization', `Bearer ${tokenShipperA}`)
        .send({ laneId })
        .expect(403);
    });

    it('should propose a consolidation group bundling Shipment 1 and Shipment 2 into 20DC', async () => {
      const res = await request(app.getHttpServer())
        .post('/match-groups/propose')
        .set('Authorization', `Bearer ${tokenFwd}`)
        .send({ laneId })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.proposalsCount).toBe(1);

      const proposal = res.body.proposals[0];
      proposedGroupId = proposal.id;

      expect(proposal.code).toMatch(/^MG\d{6}\d{3}$/);
      expect(proposal.status).toBe(MatchGroupStatus.PROPOSED);
      expect(proposal.targetContainerType.code).toBe('20DC');
      expect(proposal.shipmentCount).toBe(2);

      // Volume: 10 + 12 = 22 CBM -> fill rate in 20DC (~33.2 CBM) should be ~66.2%
      expect(Number(proposal.totalCbm)).toBe(22);
      expect(proposal.volumeFillBps).toBeGreaterThan(6000);
      expect(proposal.volumeFillBps).toBeLessThan(7500);

      // Total weight: ~9,000 kg -> fill rate in 28.2 tons payload should be ~31.9%
      expect(Number(proposal.totalWeightKg)).toBeGreaterThanOrEqual(8999);
      expect(proposal.weightFillBps).toBeGreaterThan(3000);
      expect(proposal.weightFillBps).toBeLessThan(3500);

      // Both shipments should now be in MATCHING status
      const updatedShipmentA = await request(app.getHttpServer())
        .get(`/shipments/${shipmentA1Id}`)
        .set('Authorization', `Bearer ${tokenShipperA}`)
        .expect(200);
      expect(updatedShipmentA.body.status).toBe(ShipmentStatus.MATCHING);
    });

    it('should confirm the proposed match group (PROPOSED -> CONFIRMED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/match-groups/${proposedGroupId}/confirm`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(201);

      expect(res.body.status).toBe(MatchGroupStatus.CONFIRMED);

      // Shipments in confirmed group should transition to GROUPED
      const updatedShipmentA = await request(app.getHttpServer())
        .get(`/shipments/${shipmentA1Id}`)
        .set('Authorization', `Bearer ${tokenShipperA}`)
        .expect(200);
      expect(updatedShipmentA.body.status).toBe(ShipmentStatus.GROUPED);
    });

    it('should cancel the group and restore shipments to SUBMITTED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/match-groups/${proposedGroupId}/cancel`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(201);

      expect(res.body.status).toBe(MatchGroupStatus.CANCELLED);

      // Shipments should be released back to SUBMITTED
      const restoredA = await request(app.getHttpServer())
        .get(`/shipments/${shipmentA1Id}`)
        .set('Authorization', `Bearer ${tokenShipperA}`)
        .expect(200);
      expect(restoredA.body.status).toBe(ShipmentStatus.SUBMITTED);
    });
  });

  describe('4. Manual Match Group Creation & Validation', () => {
    let manualGroupId: string;

    it('should reject manual group creation if shipments belong to a different lane', async () => {
      await request(app.getHttpServer())
        .post('/match-groups')
        .set('Authorization', `Bearer ${tokenFwd}`)
        .send({
          laneId: otherLaneId, // Wrong lane!
          targetContainerTypeId: container20DCId,
          shipmentIds: [shipmentA1Id],
        })
        .expect(400);
    });

    it('should allow forwarder to manually assemble a match group', async () => {
      const res = await request(app.getHttpServer())
        .post('/match-groups')
        .set('Authorization', `Bearer ${tokenFwd}`)
        .send({
          laneId,
          targetContainerTypeId: container20DCId,
          shipmentIds: [shipmentA1Id, shipmentB1Id],
        })
        .expect(201);

      manualGroupId = res.body.id;
      expect(res.body.status).toBe(MatchGroupStatus.PROPOSED);
      expect(res.body.shipmentCount).toBe(2);
    });

    it('should confirm manual match group', async () => {
      const res = await request(app.getHttpServer())
        .post(`/match-groups/${manualGroupId}/confirm`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(201);

      expect(res.body.status).toBe(MatchGroupStatus.CONFIRMED);
    });
  });

  describe('5. Multi-Tenant Isolation & Privacy for Consolidation', () => {
    it('Forwarder should see all match groups', async () => {
      const res = await request(app.getHttpServer())
        .get(`/match-groups?laneId=${laneId}`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it('Shipper Alpha should see match group containing their shipment', async () => {
      const res = await request(app.getHttpServer())
        .get('/match-groups')
        .set('Authorization', `Bearer ${tokenShipperA}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      const group = res.body.items[0];
      const hasAlphaShipment = group.shipments.some(
        (m: any) => m.shipment.companyId === companyAId,
      );
      expect(hasAlphaShipment).toBe(true);
    });

    it('Shipper Gamma (no shipments in group) should NOT see the match group in list', async () => {
      const res = await request(app.getHttpServer())
        .get('/match-groups')
        .set('Authorization', `Bearer ${tokenShipperGamma}`)
        .expect(200);

      expect(res.body.items.length).toBe(0);
    });

    it('Shipper Gamma should receive HTTP 404 or 403 when trying to access match group directly (via Prisma extension interception)', async () => {
      // Find manualGroupId from previous test
      const fwdRes = await request(app.getHttpServer())
        .get(`/match-groups?laneId=${laneId}`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);

      const targetId = fwdRes.body.items[0].id;

      const res = await request(app.getHttpServer())
        .get(`/match-groups/${targetId}`)
        .set('Authorization', `Bearer ${tokenShipperGamma}`);

      expect([403, 404]).toContain(res.status);
    });

    it('Forwarder and Platform Admin can both access the match group directly (cross-tenant access)', async () => {
      const fwdRes = await request(app.getHttpServer())
        .get(`/match-groups?laneId=${laneId}`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);

      const targetId = fwdRes.body.items[0].id;

      // Forwarder can read
      const fwdDetail = await request(app.getHttpServer())
        .get(`/match-groups/${targetId}`)
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);
      expect(fwdDetail.body.id).toBe(targetId);

      // Platform Admin can read
      const adminDetail = await request(app.getHttpServer())
        .get(`/match-groups/${targetId}`)
        .set('Authorization', `Bearer ${tokenPlatform}`)
        .expect(200);
      expect(adminDetail.body.id).toBe(targetId);
    });
  });

  describe('6. Stats & Metrics Endpoint', () => {
    it('should return aggregated consolidation statistics for forwarder dashboard', async () => {
      const res = await request(app.getHttpServer())
        .get('/match-groups/stats')
        .set('Authorization', `Bearer ${tokenFwd}`)
        .expect(200);

      expect(res.body.totalMatchGroups).toBeGreaterThanOrEqual(1);
      expect(res.body.activeMatchGroups).toBeGreaterThanOrEqual(1);
      expect(res.body.totalGroupedShipments).toBeGreaterThanOrEqual(2);
      expect(Number(res.body.totalGroupedCbm)).toBeGreaterThan(0);
      expect(Number(res.body.totalGroupedWeightKg)).toBeGreaterThan(0);
      expect(res.body.avgVolumeFillRate).toBeGreaterThan(0);
      expect(res.body.avgWeightFillRate).toBeGreaterThan(0);
    });
  });
});
