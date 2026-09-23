import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { StorageService } from '../src/modules/storage/storage.service';
import {
  CompanyType,
  UserRole,
  MatchGroupStatus,
  QuoteStatus,
  BookingStatus,
  LoadingProofType,
  ShipmentStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

describe('CFS Loading Proofs & Container Sealing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;

  const testSuffix = Date.now().toString();

  // Test entities
  let fwdCompany: any;
  let fwdUser: any;
  let fwdToken: string;

  let cfsCompany: any;
  let cfsUser: any;
  let cfsToken: string;

  let shipperACompany: any;
  let shipperAUser: any;
  let shipperAToken: string;

  let shipperBCompany: any;
  let shipperBUser: any;
  let shipperBToken: string;

  let shipperCCompany: any;
  let shipperCUser: any;
  let shipperCToken: string;

  let lane: any;
  let containerType: any;
  let matchGroup: any;
  let shipmentA: any;
  let shipmentB: any;
  let shipmentC: any;
  let quote: any;
  let booking: any;

  let proofInboundA: any;
  let proofLayer1: any;
  let proofSeal: any;

  // Real 1x1 valid PNG image buffer (magic bytes 89 50 4E 47 ...)
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  // Real valid JPEG image buffer (magic bytes FF D8 FF ...)
  const validJpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
    0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x00,
    0xff, 0xd9,
  ]);

  // Fake JPEG buffer (text file with .jpg extension)
  const fakeJpgBuffer = Buffer.from('Fake JPEG content without magic bytes');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get(StorageService);

    const passwordHash = await argon2.hash('LogixDemo2026!');

    // 1. Create Lane
    lane = await prisma.unsafeGlobal.lane.create({
      data: {
        code: `LANE-CFS-${testSuffix}`,
        name: 'Sài Gòn - Hải Phòng CFS Test',
        origin: 'SGN',
        destination: 'HPH',
      },
    });

    // 2. Create PricingConfig
    const pricingConfig = await prisma.unsafeGlobal.pricingConfig.create({
      data: {
        laneId: lane.id,
        version: 1,
        cbmRate: 2500000n,
        weightRateKg: 6000n,
        fixedFee: 50000n,
        standardSurchargeBps: 10000,
        irregularSurchargeBps: 11500,
        noStackSurchargeBps: 13000,
        maxEdgeRatioThreshold: 5,
      },
    });

    // 3. Create ContainerType
    containerType = await prisma.unsafeGlobal.containerType.create({
      data: {
        code: `40HC-CFS-${testSuffix}`,
        name: 'Container 40ft Cao CFS Test',
        innerLengthMm: 12032,
        innerWidthMm: 2352,
        innerHeightMm: 2698,
        volumeMm3: 76351699968n,
        maxPayloadGram: 26500000n,
        tareWeightGram: 3980000n,
      },
    });

    // 4. Create FWD Company & User
    fwdCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-FWD-${testSuffix}`,
        name: `Global FWD ${testSuffix}`,
        type: CompanyType.FWD,
      },
    });
    fwdUser = await prisma.unsafeGlobal.user.create({
      data: {
        email: `fwd_${testSuffix}@example.com`,
        passwordHash,
        role: UserRole.FWD_ADMIN,
        companyId: fwdCompany.id,
      },
    });

    // 5. Create CFS Company & User
    cfsCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-CFS-${testSuffix}`,
        name: `Hải Phòng CFS Terminal ${testSuffix}`,
        type: CompanyType.CFS,
      },
    });
    cfsUser = await prisma.unsafeGlobal.user.create({
      data: {
        email: `cfs_${testSuffix}@example.com`,
        passwordHash,
        role: UserRole.CFS_ADMIN,
        companyId: cfsCompany.id,
      },
    });

    // 6. Create Shipper A Company & User
    shipperACompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-SHP-A-${testSuffix}`,
        name: `Shipper A Textile ${testSuffix}`,
        type: CompanyType.SHIPPER,
      },
    });
    shipperAUser = await prisma.unsafeGlobal.user.create({
      data: {
        email: `shipper_a_${testSuffix}@example.com`,
        passwordHash,
        role: UserRole.SHIPPER_ADMIN,
        companyId: shipperACompany.id,
      },
    });

    // 7. Create Shipper B Company & User
    shipperBCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-SHP-B-${testSuffix}`,
        name: `Shipper B Electronics ${testSuffix}`,
        type: CompanyType.SHIPPER,
      },
    });
    shipperBUser = await prisma.unsafeGlobal.user.create({
      data: {
        email: `shipper_b_${testSuffix}@example.com`,
        passwordHash,
        role: UserRole.SHIPPER_ADMIN,
        companyId: shipperBCompany.id,
      },
    });

    // 8. Create Shipper C Company & User (Outsider, not in match group)
    shipperCCompany = await prisma.unsafeGlobal.company.create({
      data: {
        taxCode: `TAX-SHP-C-${testSuffix}`,
        name: `Shipper C Ceramics ${testSuffix}`,
        type: CompanyType.SHIPPER,
      },
    });
    shipperCUser = await prisma.unsafeGlobal.user.create({
      data: {
        email: `shipper_c_${testSuffix}@example.com`,
        passwordHash,
        role: UserRole.SHIPPER_ADMIN,
        companyId: shipperCCompany.id,
      },
    });

    // 9. Login to obtain access tokens
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'LogixDemo2026!' });
      return res.body.accessToken;
    };

    fwdToken = await login(fwdUser.email);
    cfsToken = await login(cfsUser.email);
    shipperAToken = await login(shipperAUser.email);
    shipperBToken = await login(shipperBUser.email);
    shipperCToken = await login(shipperCUser.email);

    // 10. Create Shipments for Shipper A and Shipper B
    shipmentA = await prisma.unsafeGlobal.shipment.create({
      data: {
        companyId: shipperACompany.id,
        laneId: lane.id,
        pricingConfigId: pricingConfig.id,
        trackingCode: `SHP-A-${testSuffix}`,
        status: ShipmentStatus.CONFIRMED,
        totalPackages: 10,
        volumeMm3: 15000000000n,
        weightGrams: 2000000,
        baseAmount: 37500000n,
        totalAmount: 37500000n,
        packages: {
          create: Array.from({ length: 10 }).map((_, i) => ({
            companyId: shipperACompany.id,
            packageCode: `PKG-A-${i + 1}`,
            lengthMm: 1000,
            widthMm: 1000,
            heightMm: 1500,
            volumeMm3: 1500000000n,
            weightGrams: 200000,
          })),
        },
      },
    });

    shipmentB = await prisma.unsafeGlobal.shipment.create({
      data: {
        companyId: shipperBCompany.id,
        laneId: lane.id,
        pricingConfigId: pricingConfig.id,
        trackingCode: `SHP-B-${testSuffix}`,
        status: ShipmentStatus.CONFIRMED,
        totalPackages: 8,
        volumeMm3: 12000000000n,
        weightGrams: 1500000,
        baseAmount: 30000000n,
        totalAmount: 30000000n,
        packages: {
          create: Array.from({ length: 8 }).map((_, i) => ({
            companyId: shipperBCompany.id,
            packageCode: `PKG-B-${i + 1}`,
            lengthMm: 1000,
            widthMm: 1000,
            heightMm: 1500,
            volumeMm3: 1500000000n,
            weightGrams: 187500,
          })),
        },
      },
    });

    // 11. Create MatchGroup containing Shipment A and B
    matchGroup = await prisma.unsafeGlobal.matchGroup.create({
      data: {
        code: `MG-CFS-${testSuffix}`,
        laneId: lane.id,
        targetContainerTypeId: containerType.id,
        status: MatchGroupStatus.CONFIRMED,
        totalCbmMm3: 27000000000n,
        totalWeightGrams: 3500000n,
        matchGroupShipments: {
          create: [
            {
              companyId: shipperACompany.id,
              shipmentId: shipmentA.id,
            },
            {
              companyId: shipperBCompany.id,
              shipmentId: shipmentB.id,
            },
          ],
        },
      },
    });

    // 12. Create Quote and Booking assigned to cfsCompany
    quote = await prisma.unsafeGlobal.quote.create({
      data: {
        matchGroupId: matchGroup.id,
        fwdCompanyId: fwdCompany.id,
        status: QuoteStatus.ACCEPTED,
        oceanFreight: 30000000n,
        handlingFee: 3000000n,
        documentationFee: 1000000n,
        surcharges: 1000000n,
        vatRateBps: 1000,
        vatAmount: 3500000n,
        totalAmount: 38500000n,
        transitDays: 3,
        validUntil: new Date(Date.now() + 86400000),
      },
    });

    booking = await prisma.unsafeGlobal.booking.create({
      data: {
        bookingNumber: `BKG-CFS-${testSuffix}`,
        matchGroupId: matchGroup.id,
        quoteId: quote.id,
        fwdCompanyId: fwdCompany.id,
        cfsCompanyId: cfsCompany.id,
        status: BookingStatus.CONFIRMED,
        totalAmount: 38500000n,
      },
    });
  });

  afterAll(async () => {
    try {
      if (booking?.id) {
        await prisma.unsafeGlobal.loadingProof.deleteMany({
          where: { bookingId: booking.id },
        });
        await prisma.unsafeGlobal.booking.deleteMany({
          where: { id: booking.id },
        });
      }
      if (quote?.id) {
        await prisma.unsafeGlobal.quote.deleteMany({
          where: { id: quote.id },
        });
      }
      if (matchGroup?.id) {
        await prisma.unsafeGlobal.matchGroupShipment.deleteMany({
          where: { matchGroupId: matchGroup.id },
        });
        await prisma.unsafeGlobal.matchGroup.deleteMany({
          where: { id: matchGroup.id },
        });
      }
      if (shipmentA?.id || shipmentB?.id) {
        await prisma.unsafeGlobal.package.deleteMany({
          where: { shipmentId: { in: [shipmentA?.id, shipmentB?.id].filter(Boolean) } },
        });
        await prisma.unsafeGlobal.shipment.deleteMany({
          where: { id: { in: [shipmentA?.id, shipmentB?.id].filter(Boolean) } },
        });
      }
      if (lane?.id) {
        await prisma.unsafeGlobal.pricingConfig.deleteMany({
          where: { laneId: lane.id },
        });
        await prisma.unsafeGlobal.lane.deleteMany({
          where: { id: lane.id },
        });
      }
      if (containerType?.id) {
        await prisma.unsafeGlobal.containerType.deleteMany({
          where: { id: containerType.id },
        });
      }
      const testCompIds = [
        fwdCompany?.id,
        cfsCompany?.id,
        shipperACompany?.id,
        shipperBCompany?.id,
        shipperCCompany?.id,
      ].filter(Boolean);
      if (testCompIds.length > 0) {
        await prisma.unsafeGlobal.refreshToken.deleteMany({
          where: { user: { companyId: { in: testCompIds } } },
        });
        await prisma.unsafeGlobal.user.deleteMany({
          where: { companyId: { in: testCompIds } },
        });
        await prisma.unsafeGlobal.company.deleteMany({
          where: { id: { in: testCompIds } },
        });
      }
    } finally {
      await app.close();
    }
  });

  // ==========================================================================
  // SUITE 1: FILE UPLOAD VALIDATION & SECURITY CONSTRAINTS (Adjustment 2)
  // ==========================================================================
  describe('1. File Upload Validation & Security Constraints', () => {
    it('1.1: should reject fake image files without valid magic bytes (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/loading-proofs/upload')
        .set('Authorization', `Bearer ${cfsToken}`)
        .field('bookingId', booking.id)
        .field('matchGroupId', matchGroup.id)
        .field('proofType', LoadingProofType.INBOUND_INSPECTION)
        .field('shipmentId', shipmentA.id)
        .attach('file', fakeJpgBuffer, 'fake.jpg');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Định dạng tệp không hợp lệ');
    });

    it('1.2: should accept valid PNG buffer with real magic bytes', async () => {
      const res = await request(app.getHttpServer())
        .post('/loading-proofs/upload')
        .set('Authorization', `Bearer ${cfsToken}`)
        .field('bookingId', booking.id)
        .field('matchGroupId', matchGroup.id)
        .field('proofType', LoadingProofType.INBOUND_INSPECTION)
        .field('shipmentId', shipmentA.id)
        .attach('file', validPngBuffer, 'inspection-a.png');

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.mimeType).toBe('image/png');
      expect(res.body.presignedUrl).toContain('X-Amz-Expires=900');
      proofInboundA = res.body;
    });

    it('1.3: should reject file exceeding 10MB limit (400 Bad Request)', async () => {
      // 10.5MB dummy buffer
      const largeBuffer = Buffer.alloc(10.5 * 1024 * 1024, 0xff);
      // set valid jpeg magic bytes
      largeBuffer[0] = 0xff;
      largeBuffer[1] = 0xd8;
      largeBuffer[2] = 0xff;

      const res = await request(app.getHttpServer())
        .post('/loading-proofs/upload')
        .set('Authorization', `Bearer ${cfsToken}`)
        .field('bookingId', booking.id)
        .field('matchGroupId', matchGroup.id)
        .field('proofType', LoadingProofType.INBOUND_INSPECTION)
        .field('shipmentId', shipmentA.id)
        .attach('file', largeBuffer, 'huge.jpg');

      expect([400, 413]).toContain(res.status);
    });

    it('1.4: should generate server-side UUID key and not use original filename as key', async () => {
      const res = await request(app.getHttpServer())
        .post('/loading-proofs/upload')
        .set('Authorization', `Bearer ${cfsToken}`)
        .field('bookingId', booking.id)
        .field('matchGroupId', matchGroup.id)
        .field('proofType', LoadingProofType.LAYER_PACKED)
        .field('layerIndex', 1)
        .attach('file', validJpgBuffer, 'my-arbitrary-hacked-name.jpg');

      expect(res.status).toBe(201);
      expect(res.body.fileKey).toMatch(/^proofs\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.jpg$/);
      expect(res.body.fileKey).not.toContain('my-arbitrary-hacked-name');
      proofLayer1 = res.body;
    });
  });

  // ==========================================================================
  // SUITE 2: MULTI-TENANT ACCESS CONTROL & ISOLATION (Shipper B vs Shipper A)
  // ==========================================================================
  describe('2. Multi-Tenant Access Control & Isolation', () => {
    it('2.1: Shipper A can view their own INBOUND_INSPECTION photo (HTTP 200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/loading-proofs/${proofInboundA.id}`)
        .set('Authorization', `Bearer ${shipperAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(proofInboundA.id);
      expect(res.body.presignedUrl).toBeDefined();
    });

    it('2.2: Shipper B directly requesting ID of Shipper A photo returns 403 Forbidden (findUnique)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/loading-proofs/${proofInboundA.id}`)
        .set('Authorization', `Bearer ${shipperBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Bạn không có quyền truy cập');
    });

    it('2.3: Shipper B listing proofs for booking DOES NOT receive Shipper A inbound photo (findMany)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/loading-proofs/booking/${booking.id}`)
        .set('Authorization', `Bearer ${shipperBToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const foundProofA = res.body.find((p: any) => p.id === proofInboundA.id);
      expect(foundProofA).toBeUndefined();
    });

    it('2.4: Both Shipper A and Shipper B can view shared LAYER_PACKED photo (HTTP 200)', async () => {
      const resA = await request(app.getHttpServer())
        .get(`/loading-proofs/${proofLayer1.id}`)
        .set('Authorization', `Bearer ${shipperAToken}`);
      expect(resA.status).toBe(200);

      const resB = await request(app.getHttpServer())
        .get(`/loading-proofs/${proofLayer1.id}`)
        .set('Authorization', `Bearer ${shipperBToken}`);
      expect(resB.status).toBe(200);
    });

    it('2.5: Third-party Shipper C cannot view any photos of this container (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/loading-proofs/${proofLayer1.id}`)
        .set('Authorization', `Bearer ${shipperCToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // SUITE 3: REAL PRESIGNED URL EXPIRATION TEST (Adjustment 3)
  // ==========================================================================
  describe('3. Real Presigned URL Expiration against MinIO', () => {
    it('3.1: should generate URL with 2s expiry, wait 3s, and receive HTTP 403 / Request has expired from MinIO', async () => {
      // 1. Generate URL with 2 seconds validity
      const res = await request(app.getHttpServer())
        .get(`/loading-proofs/${proofLayer1.id}?expiresIn=2`)
        .set('Authorization', `Bearer ${cfsToken}`);

      expect(res.status).toBe(200);
      const presignedUrl = res.body.presignedUrl;
      expect(presignedUrl).toContain('X-Amz-Expires=2');

      // 2. Immediate call should succeed (within 2s)
      const immediateRes = await fetch(presignedUrl);
      expect(immediateRes.status).toBe(200);

      // 3. Wait 3 seconds for expiration (Adjustment 3)
      console.log('  ⏳ Waiting 3 seconds for MinIO presigned URL to expire...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 4. Call again after expiration: MinIO MUST reject with 403
      const expiredRes = await fetch(presignedUrl);
      const errorText = await expiredRes.text();

      console.log('  ✓ MinIO expired response status:', expiredRes.status);
      console.log('  ✓ MinIO expired response body excerpt:', errorText.slice(0, 180));

      expect(expiredRes.status).toBe(403);
      expect(errorText).toContain('Request has expired');
    }, 15000);
  });

  // ==========================================================================
  // SUITE 4: REAL MINIO UPLOAD & DOWNLOAD VERIFICATION
  // ==========================================================================
  describe('4. Real Upload & Download Verification against MinIO', () => {
    it('4.1: should upload and download exact buffer from MinIO', async () => {
      const testKey = `proofs/test-verification/${testSuffix}.png`;
      await storage.uploadFile(testKey, validPngBuffer, 'image/png');

      const downloadedBuffer = await storage.downloadBuffer(testKey);
      expect(downloadedBuffer.equals(validPngBuffer)).toBe(true);
      console.log(`  ✓ Successfully verified MinIO upload & download for key: ${testKey} (${downloadedBuffer.length} bytes)`);
    });
  });

  // ==========================================================================
  // SUITE 5: CFS TALLY & SEALING CONTAINER WORKFLOW
  // ==========================================================================
  describe('5. CFS Tally & Sealing Container Workflow', () => {
    it('5.1: CFS tallies shipment A with actual count and discrepancy', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cfs/tally/${matchGroup.id}/shipment/${shipmentA.id}`)
        .set('Authorization', `Bearer ${cfsToken}`)
        .send({
          actualPackageCount: 9,
          isDiscrepant: true,
          discrepancyReason: 'Khai báo 10 kiện, thực nhận 9 kiện, thiếu 1 kiện',
        });

      expect(res.status).toBe(201);
      expect(res.body.actualPackageCount).toBe(9);
      expect(res.body.isDiscrepant).toBe(true);
      expect(res.body.tallyStatus).toBe('DISCREPANT');
    });

    it('5.2: Sealing container without SEAL_CLOSED photo is rejected (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cfs/seal-container/${booking.id}`)
        .set('Authorization', `Bearer ${cfsToken}`)
        .send({
          containerNo: 'TCLU-982145-2',
          sealNo: 'VN-HP-00892',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('SEAL_CLOSED');
    });

    it('5.3: CFS uploads SEAL_CLOSED photo and confirms sealing successfully', async () => {
      // Upload SEAL_CLOSED proof
      const uploadRes = await request(app.getHttpServer())
        .post('/loading-proofs/upload')
        .set('Authorization', `Bearer ${cfsToken}`)
        .field('bookingId', booking.id)
        .field('matchGroupId', matchGroup.id)
        .field('proofType', LoadingProofType.SEAL_CLOSED)
        .attach('file', validJpgBuffer, 'seal-proof.jpg');

      expect(uploadRes.status).toBe(201);
      proofSeal = uploadRes.body;

      // Now seal container
      const sealRes = await request(app.getHttpServer())
        .post(`/cfs/seal-container/${booking.id}`)
        .set('Authorization', `Bearer ${cfsToken}`)
        .send({
          containerNo: 'TCLU-982145-2',
          sealNo: 'VN-HP-00892',
          notes: 'Đã hoàn tất đóng cont và niêm chì hải quan',
        });

      expect(sealRes.status).toBe(201);
      expect(sealRes.body.status).toBe('SEALED');
      expect(sealRes.body.containerNo).toBe('TCLU-982145-2');
      expect(sealRes.body.sealNo).toBe('VN-HP-00892');

      // Verify shipments in the group transitioned to SEALED
      const updatedShipment = await prisma.unsafeGlobal.shipment.findUnique({
        where: { id: shipmentA.id },
      });
      expect(updatedShipment?.status).toBe('SEALED');
    });

    it('5.4: CFS metrics reflect actual counts in database', async () => {
      const res = await request(app.getHttpServer())
        .get('/cfs/metrics')
        .set('Authorization', `Bearer ${cfsToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sealedContainers).toBeGreaterThanOrEqual(1);
    });
  });
});
