import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import {
  PrismaClient,
  CompanyType,
  CompanyStatus,
  UserRole,
  UserStatus,
  ShipmentStatus,
  PackageType,
  MatchGroupStatus,
  QuoteStatus,
  BookingStatus,
  LoadingProofType,
} from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import * as argon2 from 'argon2';
import { calculateShipmentPricing, PackagePricingInput, PricingConfigInput } from '@logix/shared';

const prisma = new PrismaClient();

const SAMPLE_PROOF_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export const CANONICAL_LANES = [
  {
    code: 'SGN-HPH',
    name: 'Sài Gòn - Hải Phòng',
    origin: 'SGN',
    destination: 'HPH',
    cbmRate: 2_500_000n,
    weightRateKg: 6_000n,
    fixedFee: 50_000n,
    standardSurchargeBps: 10000,
    irregularSurchargeBps: 11500,
    noStackSurchargeBps: 13000,
    maxEdgeRatioThreshold: 5,
  },
  {
    code: 'SGN-DAD',
    name: 'Sài Gòn - Đà Nẵng',
    origin: 'SGN',
    destination: 'DAD',
    cbmRate: 1_800_000n,
    weightRateKg: 4_500n,
    fixedFee: 40_000n,
    standardSurchargeBps: 10000,
    irregularSurchargeBps: 11500,
    noStackSurchargeBps: 13000,
    maxEdgeRatioThreshold: 5,
  },
  {
    code: 'HAN-SGN',
    name: 'Hà Nội - Sài Gòn',
    origin: 'HAN',
    destination: 'SGN',
    cbmRate: 2_800_000n,
    weightRateKg: 7_000n,
    fixedFee: 60_000n,
    standardSurchargeBps: 10000,
    irregularSurchargeBps: 11500,
    noStackSurchargeBps: 13000,
    maxEdgeRatioThreshold: 5,
  },
];

export const STANDARD_CONTAINERS = [
  {
    code: '20DC',
    name: 'Container 20ft Tiêu Chuẩn (20DC)',
    innerLengthMm: 5898,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    volumeMm3: BigInt(5898) * BigInt(2352) * BigInt(2393),
    maxPayloadGram: 28200000n,
    tareWeightGram: 2280000n,
    isActive: true,
  },
  {
    code: '40DC',
    name: 'Container 40ft Tiêu Chuẩn (40DC)',
    innerLengthMm: 12032,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    volumeMm3: BigInt(12032) * BigInt(2352) * BigInt(2393),
    maxPayloadGram: 26700000n,
    tareWeightGram: 3780000n,
    isActive: true,
  },
  {
    code: '40HC',
    name: 'Container 40ft Cao (40HC)',
    innerLengthMm: 12032,
    innerWidthMm: 2352,
    innerHeightMm: 2698,
    volumeMm3: BigInt(12032) * BigInt(2352) * BigInt(2698), // 76,351,699,968 mm3
    maxPayloadGram: 26500000n, // 26,500 kg
    tareWeightGram: 3980000n,
    isActive: true,
  },
];

export async function seedLanesAndCleanDuplicates(client: PrismaClient = prisma) {
  console.log('\n--- 1. SEEDING CANONICAL LANES & PRICING ---');

  const createdLanes: Record<string, any> = {};

  for (const item of CANONICAL_LANES) {
    const lane = await client.lane.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        origin: item.origin,
        destination: item.destination,
        isActive: true,
      },
      create: {
        code: item.code,
        name: item.name,
        origin: item.origin,
        destination: item.destination,
        isActive: true,
      },
    });

    createdLanes[item.code] = lane;

    const activePricing = await client.pricingConfig.findFirst({
      where: {
        laneId: lane.id,
        effectiveTo: null,
      },
    });

    if (!activePricing) {
      await client.pricingConfig.create({
        data: {
          laneId: lane.id,
          version: 1,
          cbmRate: item.cbmRate,
          weightRateKg: item.weightRateKg,
          fixedFee: item.fixedFee,
          standardSurchargeBps: item.standardSurchargeBps,
          irregularSurchargeBps: item.irregularSurchargeBps,
          noStackSurchargeBps: item.noStackSurchargeBps,
          maxEdgeRatioThreshold: item.maxEdgeRatioThreshold,
          effectiveFrom: new Date(),
          effectiveTo: null,
        },
      });
    } else {
      await client.pricingConfig.update({
        where: { id: activePricing.id },
        data: {
          cbmRate: item.cbmRate,
          weightRateKg: item.weightRateKg,
          fixedFee: item.fixedFee,
        },
      });
    }

    console.log(`✓ Lane ${item.code} (${item.name}): ${item.cbmRate} VND/CBM, ${item.weightRateKg} VND/kg`);
  }

  // Clean up obsolete duplicate test lanes (e.g. LANE-1789...)
  const targetLaneId = createdLanes['SGN-HPH'].id;
  const obsoleteLanes = await client.lane.findMany({
    where: {
      code: {
        notIn: CANONICAL_LANES.map((l) => l.code),
      },
    },
    select: { id: true, code: true },
  });

  if (obsoleteLanes.length > 0) {
    console.log(`Found ${obsoleteLanes.length} obsolete/duplicate test lanes. Cleaning up...`);
    const obsoleteIds = obsoleteLanes.map((l) => l.id);

    const targetPricing = await client.pricingConfig.findFirstOrThrow({
      where: { laneId: targetLaneId, effectiveTo: null },
    });

    const obsoletePricings = await client.pricingConfig.findMany({
      where: { laneId: { in: obsoleteIds } },
      select: { id: true },
    });
    const obsoletePricingIds = obsoletePricings.map((p) => p.id);

    await client.shipment.updateMany({
      where: {
        OR: [
          { laneId: { in: obsoleteIds } },
          { pricingConfigId: { in: obsoletePricingIds } },
        ],
      },
      data: {
        laneId: targetLaneId,
        pricingConfigId: targetPricing.id,
      },
    });

    await client.matchGroup.updateMany({
      where: { laneId: { in: obsoleteIds } },
      data: { laneId: targetLaneId },
    });

    await client.pricingConfig.deleteMany({
      where: { id: { in: obsoletePricingIds } },
    });

    await client.lane.deleteMany({
      where: { id: { in: obsoleteIds } },
    });

    console.log(`✓ Successfully cleaned up ${obsoleteLanes.length} obsolete lanes.`);
  }

  // Ensure Container Types are seeded
  for (const c of STANDARD_CONTAINERS) {
    await client.containerType.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        innerLengthMm: c.innerLengthMm,
        innerWidthMm: c.innerWidthMm,
        innerHeightMm: c.innerHeightMm,
        volumeMm3: c.volumeMm3,
        maxPayloadGram: c.maxPayloadGram,
        tareWeightGram: c.tareWeightGram,
        isActive: true,
      },
      create: c,
    });
  }

  return createdLanes;
}

// ============================================================================
// DEFINITIONS FOR 25 DEMO ACCOUNTS & 15 REALISTIC VIETNAMESE ENTERPRISES
// ============================================================================

export const DEMO_PASSWORD = 'LogixDemo2026!';

export const PLATFORM_ADMIN_USERS = [
  {
    email: 'admin01@logix.vn',
    fullName: 'Nguyễn Văn An (Platform Admin Cấp Cao)',
    phone: '0901234501',
    role: UserRole.PLATFORM_ADMIN,
  },
  {
    email: 'admin02@logix.vn',
    fullName: 'Lê Thị Bình (Platform Admin Vận Hành)',
    phone: '0901234502',
    role: UserRole.PLATFORM_ADMIN,
  },
];

export const ADMIN_COMPANY = {
  taxCode: '0108888999',
  name: 'Tập đoàn Công nghệ Nền tảng Logix Platform',
  type: CompanyType.FWD,
  status: CompanyStatus.VERIFIED,
  address: 'Tầng 25, Landmark 81, Bình Thạnh, TP. Hồ Chí Minh',
  phone: '02873009999',
  email: 'contact@logix.vn',
};

export const FWD_COMPANIES = [
  {
    taxCode: '0108888101',
    name: 'Công ty Cổ phần Vận tải & Tiếp vận Toàn Cầu (Global Trans FWD)',
    email: 'fwd01@logix.vn',
    fullName: 'Trần Đình Trọng (Điều Phối Viên FWD)',
    address: 'Số 120 Võ Văn Kiệt, Quận 1, TP. Hồ Chí Minh',
    phone: '02838220001',
    role: UserRole.FWD_ADMIN,
  },
  {
    taxCode: '0108888102',
    name: 'Công ty TNHH Giao nhận Vận tải Á Châu (Asia Logistics FWD)',
    email: 'fwd02@logix.vn',
    fullName: 'Hoàng Minh Đức (Trưởng Phòng Điều Phối FWD)',
    address: 'Số 45 Lê Duẩn, Quận Hải Châu, TP. Đà Nẵng',
    phone: '02363820002',
    role: UserRole.FWD_ADMIN,
  },
  {
    taxCode: '0108888103',
    name: 'Công ty CP Tiếp vận Quốc tế Đại Dương (Ocean Express FWD)',
    email: 'fwd03@logix.vn',
    fullName: 'Vũ Thanh Tùng (Giám Đốc Khai Thác FWD)',
    address: 'Số 88 Lê Thánh Tông, Ngô Quyền, TP. Hải Phòng',
    phone: '02253820003',
    role: UserRole.FWD_ADMIN,
  },
  {
    taxCode: '0108888104',
    name: 'Công ty TNHH Vận tải Liên Minh Phương Đông (Orient Freight FWD)',
    email: 'fwd04@logix.vn',
    fullName: 'Nguyễn Mai Phương (Quản Lý Vận Hành FWD)',
    address: 'Số 18 Phạm Hùng, Nam Từ Liêm, TP. Hà Nội',
    phone: '02437820004',
    role: UserRole.FWD_ADMIN,
  },
  {
    taxCode: '0108888105',
    name: 'Công ty CP Logistics Hàng hải Bắc Nam (North-South Marine FWD)',
    email: 'fwd05@logix.vn',
    fullName: 'Bùi Anh Tuấn (Điều Phối Viên Tổng Hợp FWD)',
    address: 'Số 200 Nguyễn Tất Thành, Quận 4, TP. Hồ Chí Minh',
    phone: '02839400005',
    role: UserRole.FWD_ADMIN,
  },
];

export const CFS_COMPANIES = [
  {
    taxCode: '0108888201',
    name: 'Công ty TNHH Kho vận CFS Cảng Hải Phòng (Hải Phòng CFS Terminal)',
    email: 'cfs01@logix.vn',
    fullName: 'Đỗ Văn Quang (Quản Lý Kho CFS Tân Vũ)',
    address: 'Khu công nghiệp Đình Vũ, Đông Hải 2, Hải An, TP. Hải Phòng',
    phone: '02253890201',
    note: 'Kho CFS Tân Vũ - Hải Phòng (Cửa ngõ miền Bắc)',
    role: UserRole.CFS_ADMIN,
  },
  {
    taxCode: '0108888202',
    name: 'Công ty CP Dịch vụ Kho bãi CFS Cát Lái (Cát Lái Logistics CFS)',
    email: 'cfs02@logix.vn',
    fullName: 'Trịnh Hoài Nam (Trưởng Trạm CFS Cát Lái)',
    address: 'Cổng B Cảng Cát Lái, Đường Nguyễn Thị Định, TP. Thủ Đức, TP. Hồ Chí Minh',
    phone: '02837420202',
    note: 'Kho CFS Cảng Cát Lái - TP.HCM (Cửa ngõ miền Nam)',
    role: UserRole.CFS_ADMIN,
  },
  {
    taxCode: '0108888203',
    name: 'Công ty TNHH Tiếp vận Kho CFS Cảng Đà Nẵng (Đà Nẵng Port CFS Hub)',
    email: 'cfs03@logix.vn',
    fullName: 'Phan Thị Hương (Giám Đốc Kho CFS Tiên Sa)',
    address: 'Cảng Tiên Sa, Số 01 Yết Kiêu, Thọ Quang, Sơn Trà, TP. Đà Nẵng',
    phone: '02363840203',
    note: 'Kho CFS Tiên Sa - Đà Nẵng (Cửa ngõ miền Trung)',
    role: UserRole.CFS_ADMIN,
  },
];

export interface ShipperDef {
  code: string;
  email: string;
  taxCode: string;
  name: string;
  industry: string;
  fullName: string;
  primaryLane: 'SGN-HPH' | 'SGN-DAD' | 'HAN-SGN';
  address: string;
  phone: string;
}

export const SHIPPER_COMPANIES: ShipperDef[] = [
  // Tuyến SGN-HPH (6 Shippers: S01 đến S06) ~ 40%
  {
    code: 'S01',
    email: 'shipper01@logix.vn',
    taxCode: '0108888301',
    name: 'Công ty CP Dệt May Hòa Phát',
    industry: 'Dệt may & Thời trang may sẵn',
    fullName: 'Lê Minh Hưng (Giám Đốc Xuất Nhập Khẩu)',
    primaryLane: 'SGN-HPH',
    address: 'KCN Tân Bình, Tây Thạnh, Tân Phú, TP. Hồ Chí Minh',
    phone: '02838150301',
  },
  {
    code: 'S02',
    email: 'shipper02@logix.vn',
    taxCode: '0108888302',
    name: 'Công ty TNHH Điện Tử Tân Cường',
    industry: 'Linh kiện & Thiết bị vi điện tử',
    fullName: 'Trần Thị Mai (Trưởng Phòng Logistics)',
    primaryLane: 'SGN-HPH',
    address: 'Khu Công Nghệ Cao, Tăng Nhơn Phú B, TP. Thủ Đức, TP. Hồ Chí Minh',
    phone: '02837360302',
  },
  {
    code: 'S03',
    email: 'shipper03@logix.vn',
    taxCode: '0108888303',
    name: 'Công ty CP Nội Thất Cát Tường',
    industry: 'Nội thất gỗ xuất khẩu & Thủ công mỹ nghệ',
    fullName: 'Phạm Đức Long (Quản Lý Chuỗi Cung Ứng)',
    primaryLane: 'SGN-HPH',
    address: 'KCN Sóng Thần 1, Dĩ An, Bình Dương',
    phone: '02743790303',
  },
  {
    code: 'S04',
    email: 'shipper04@logix.vn',
    taxCode: '0108888304',
    name: 'Công ty TNHH Cơ Khí Chế Tạo Dũng Tiến',
    industry: 'Cơ khí chính xác & Phụ tùng máy công nghiệp',
    fullName: 'Hoàng Dũng Tiến (Giám Đốc Vận Hành)',
    primaryLane: 'SGN-HPH',
    address: 'KCN Linh Trung 2, Tam Bình, TP. Thủ Đức, TP. Hồ Chí Minh',
    phone: '02837290304',
  },
  {
    code: 'S05',
    email: 'shipper05@logix.vn',
    taxCode: '0108888305',
    name: 'Công ty CP Nông Sản Xuất Khẩu Việt Hương',
    industry: 'Nông sản sấy, Cà phê & Hạt điều chế biến',
    fullName: 'Ngô Đình Khang (Phó Giám Đốc Kinh Doanh)',
    primaryLane: 'SGN-HPH',
    address: 'KCN Long Hậu, Cần Giuộc, Long An',
    phone: '02723870305',
  },
  {
    code: 'S06',
    email: 'shipper06@logix.vn',
    taxCode: '0108888306',
    name: 'Công ty TNHH Thủy Hải Sản Biển Đông',
    industry: 'Thủy hải sản chế biến & Thực phẩm đóng hộp',
    fullName: 'Đặng Thùy Dương (Trưởng Bộ Phận Giao Nhận)',
    primaryLane: 'SGN-HPH',
    address: 'KCN Hiệp Phước, Nhà Bè, TP. Hồ Chí Minh',
    phone: '02837800306',
  },

  // Tuyến SGN-DAD (5 Shippers: S07 đến S11) ~ 30%
  {
    code: 'S07',
    email: 'shipper07@logix.vn',
    taxCode: '0108888307',
    name: 'Công ty CP Sản Xuất Nhựa Rạng Đông Á',
    industry: 'Hạt nhựa kỹ thuật & Bao bì màng ghép',
    fullName: 'Lâm Vĩnh Hảo (Trưởng Phòng Xuất Nhập Khẩu)',
    primaryLane: 'SGN-DAD',
    address: 'KCN Vĩnh Lộc, Bình Chánh, TP. Hồ Chí Minh',
    phone: '02837650307',
  },
  {
    code: 'S08',
    email: 'shipper08@logix.vn',
    taxCode: '0108888308',
    name: 'Công ty TNHH Giấy & Bao Bì Tân Phát',
    industry: 'Thùng carton sóng & Bao bì giấy công nghiệp',
    fullName: 'Trương Hoài Linh (Quản Lý Phân Phối)',
    primaryLane: 'SGN-DAD',
    address: 'KCN Đức Hòa 1, Đức Hòa, Long An',
    phone: '02723770308',
  },
  {
    code: 'S09',
    email: 'shipper09@logix.vn',
    taxCode: '0108888309',
    name: 'Công ty CP Hóa Mỹ Phẩm Sài Gòn Hoa',
    industry: 'Chất tẩy rửa sinh học & Hóa mỹ phẩm gia dụng',
    fullName: 'Võ Thanh Tuyền (Trưởng Phòng Điều Vận)',
    primaryLane: 'SGN-DAD',
    address: 'KCN Tân Tạo, Tân Tạo A, Bình Tân, TP. Hồ Chí Minh',
    phone: '02837540309',
  },
  {
    code: 'S10',
    email: 'shipper10@logix.vn',
    taxCode: '0108888310',
    name: 'Công ty TNHH Thực Phẩm Chế Biến Ánh Dương',
    industry: 'Bánh kẹo truyền thống & Nước giải khát',
    fullName: 'Nguyễn Tuấn Kiệt (Phụ Trách Kho Vận)',
    primaryLane: 'SGN-DAD',
    address: 'KCN Tân Bình mở rộng, Bình Hưng Hòa, Bình Tân, TP. Hồ Chí Minh',
    phone: '02837670310',
  },
  {
    code: 'S11',
    email: 'shipper11@logix.vn',
    taxCode: '0108888311',
    name: 'Công ty CP Gốm Sứ Mỹ Nghệ Sài Gòn Xưa',
    industry: 'Gốm sứ tráng men & Đồ trang trí nội thất',
    fullName: 'Bạch Hoàng Yến (Giám Đốc Thương Mại)',
    primaryLane: 'SGN-DAD',
    address: 'KCN Bình Đường, An Bình, Dĩ An, Bình Dương',
    phone: '02743790311',
  },

  // Tuyến HAN-SGN (4 Shippers: S12 đến S15) ~ 30%
  {
    code: 'S12',
    email: 'shipper12@logix.vn',
    taxCode: '0108888312',
    name: 'Công ty TNHH Da Giày Xuất Khẩu Thịnh Vượng',
    industry: 'Giày dép da & Túi xách thời trang xuất khẩu',
    fullName: 'Tống Gia Huy (Trưởng Phòng Kế Hoạch)',
    primaryLane: 'HAN-SGN',
    address: 'KCN Quang Minh, Mê Linh, TP. Hà Nội',
    phone: '02438180312',
  },
  {
    code: 'S13',
    email: 'shipper13@logix.vn',
    taxCode: '0108888313',
    name: 'Công ty CP Dệt Kỹ Thuật Nam Phong',
    industry: 'Sợi công nghiệp & Vải địa kỹ thuật',
    fullName: 'Quách Bảo Ngọc (Quản Lý Chuỗi Cung Ứng)',
    primaryLane: 'HAN-SGN',
    address: 'KCN Phố Nối A, Trưng Trắc, Văn Lâm, Hưng Yên',
    phone: '02213980313',
  },
  {
    code: 'S14',
    email: 'shipper14@logix.vn',
    taxCode: '0108888314',
    name: 'Công ty TNHH Thiết Bị Gia Dụng SunHome',
    industry: 'Thiết bị gia dụng nhà bếp & Đèn LED chiếu sáng',
    fullName: 'Triệu Quốc Đạt (Trưởng Phòng Xuất Nhập Khẩu)',
    primaryLane: 'HAN-SGN',
    address: 'KCN Thăng Long 1, Kim Chung, Đông Anh, TP. Hà Nội',
    phone: '02439580314',
  },
  {
    code: 'S15',
    email: 'shipper15@logix.vn',
    taxCode: '0108888315',
    name: 'Công ty CP Dược & Thiết Bị Y Tế Đại Thành',
    industry: 'Thiết bị y tế tiêu hao & Dược phẩm đóng gói',
    fullName: 'Hà Bích Diệp (Giám Đốc Logistics)',
    primaryLane: 'HAN-SGN',
    address: 'KCN Tiên Sơn, Đồng Nguyên, Từ Sơn, Bắc Ninh',
    phone: '02223730315',
  },
];

function generatePackagesForShipment(
  shipper: ShipperDef,
  status: ShipmentStatus,
): Array<{
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
  isFragile: boolean;
  noStack: boolean;
  description: string;
}> {
  if (status === ShipmentStatus.DRAFT) {
    return [
      {
        lengthMm: 450,
        widthMm: 350,
        heightMm: 300,
        weightGrams: 15000,
        isFragile: false,
        noStack: false,
        description: `Thùng hàng mẫu thử nghiệm #${shipper.code}-01`,
      },
      {
        lengthMm: 500,
        widthMm: 400,
        heightMm: 350,
        weightGrams: 22000,
        isFragile: shipper.code === 'S02' || shipper.code === 'S11',
        noStack: false,
        description: `Thùng tài liệu & sản phẩm thử #${shipper.code}-02`,
      },
    ];
  }

  if (status === ShipmentStatus.PRICED) {
    return [
      { lengthMm: 1000, widthMm: 800, heightMm: 800, weightGrams: 120000, isFragile: false, noStack: false, description: `Kiện hàng tiêu chuẩn A1` },
      { lengthMm: 1000, widthMm: 800, heightMm: 800, weightGrams: 120000, isFragile: false, noStack: false, description: `Kiện hàng tiêu chuẩn A2` },
      { lengthMm: 900, widthMm: 700, heightMm: 700, weightGrams: 85000, isFragile: shipper.code === 'S02' || shipper.code === 'S09', noStack: false, description: `Kiện hàng trung bình B1` },
      { lengthMm: 900, widthMm: 700, heightMm: 700, weightGrams: 85000, isFragile: shipper.code === 'S02' || shipper.code === 'S09', noStack: false, description: `Kiện hàng trung bình B2` },
      { lengthMm: 1200, widthMm: 800, heightMm: 500, weightGrams: 95000, isFragile: false, noStack: shipper.code === 'S03' || shipper.code === 'S11', description: `Kiện hàng dẹt C1 (Cấm đè)` },
      { lengthMm: 800, widthMm: 600, heightMm: 600, weightGrams: 60000, isFragile: true, noStack: false, description: `Kiện hàng dễ vỡ D1` },
    ];
  }

  if (status === ShipmentStatus.SUBMITTED) {
    return [
      { lengthMm: 1100, widthMm: 900, heightMm: 900, weightGrams: 160000, isFragile: false, noStack: false, description: `Lô thành phẩm đợt 1` },
      { lengthMm: 1100, widthMm: 900, heightMm: 900, weightGrams: 160000, isFragile: false, noStack: false, description: `Lô thành phẩm đợt 2` },
      { lengthMm: 1000, widthMm: 800, heightMm: 900, weightGrams: 140000, isFragile: false, noStack: false, description: `Lô phụ kiện kèm theo` },
      { lengthMm: 1000, widthMm: 800, heightMm: 900, weightGrams: 140000, isFragile: false, noStack: false, description: `Lô vật tư lắp ráp` },
      { lengthMm: 800, widthMm: 800, heightMm: 800, weightGrams: 90000, isFragile: true, noStack: false, description: `Thiết bị điều khiển chính` },
      { lengthMm: 1200, widthMm: 600, heightMm: 600, weightGrams: 110000, isFragile: false, noStack: true, description: `Khung mặt bàn chịu lực (Cấm đè)` },
      { lengthMm: 700, widthMm: 600, heightMm: 500, weightGrams: 45000, isFragile: false, noStack: false, description: `Hộp phụ tùng thay thế` },
    ];
  }

  const pkgTemplates = [
    { lengthMm: 1200, widthMm: 1000, heightMm: 1000, weightGrams: 210000, isFragile: false, noStack: false, description: `${shipper.industry} - Khối chính 01` },
    { lengthMm: 1200, widthMm: 1000, heightMm: 1000, weightGrams: 210000, isFragile: false, noStack: false, description: `${shipper.industry} - Khối chính 02` },
    { lengthMm: 1100, widthMm: 900, heightMm: 1000, weightGrams: 175000, isFragile: false, noStack: false, description: `${shipper.industry} - Thùng linh kiện A` },
    { lengthMm: 1100, widthMm: 900, heightMm: 900, weightGrams: 150000, isFragile: false, noStack: false, description: `${shipper.industry} - Thùng linh kiện B` },
    { lengthMm: 1000, widthMm: 800, heightMm: 900, weightGrams: 130000, isFragile: false, noStack: false, description: `${shipper.industry} - Sản phẩm đóng thùng` },
    { lengthMm: 1000, widthMm: 800, heightMm: 900, weightGrams: 130000, isFragile: false, noStack: false, description: `${shipper.industry} - Phụ liệu hoàn thiện` },
    { lengthMm: 1100, widthMm: 800, heightMm: 800, weightGrams: 125000, isFragile: false, noStack: false, description: `${shipper.industry} - Khối tầng trên 01` },
    { lengthMm: 1100, widthMm: 800, heightMm: 800, weightGrams: 125000, isFragile: false, noStack: false, description: `${shipper.industry} - Khối tầng trên 02` },
    { lengthMm: 1100, widthMm: 900, heightMm: 850, weightGrams: 140000, isFragile: false, noStack: false, description: `${shipper.industry} - Thùng hàng trung cấp 03` },
    { lengthMm: 1000, widthMm: 900, heightMm: 800, weightGrams: 130000, isFragile: false, noStack: false, description: `${shipper.industry} - Khối hàng tối ưu tầng 2` },
    { lengthMm: 1000, widthMm: 1000, heightMm: 800, weightGrams: 145000, isFragile: shipper.code === 'S02' || shipper.code === 'S14', noStack: false, description: `${shipper.industry} - Hàng điện máy nhạy cảm` },
    { lengthMm: 1200, widthMm: 800, heightMm: 700, weightGrams: 110000, isFragile: false, noStack: shipper.code === 'S03' || shipper.code === 'S11', description: `${shipper.industry} - Hàng mặt gương/kính (Cấm đè)` },
  ];

  return pkgTemplates;
}

export async function seedDemoData(client: PrismaClient = prisma) {
  const lanes = await seedLanesAndCleanDuplicates(client);

  const lanePricingInputs: Record<string, PricingConfigInput> = {};
  for (const code of ['SGN-HPH', 'SGN-DAD', 'HAN-SGN']) {
    const laneObj = lanes[code];
    const pricingObj = await client.pricingConfig.findFirstOrThrow({
      where: { laneId: laneObj.id, effectiveTo: null },
    });
    lanePricingInputs[code] = {
      cbmRate: pricingObj.cbmRate,
      weightRateKg: pricingObj.weightRateKg,
      fixedFee: pricingObj.fixedFee,
      standardSurchargeBps: pricingObj.standardSurchargeBps,
      irregularSurchargeBps: pricingObj.irregularSurchargeBps,
      noStackSurchargeBps: pricingObj.noStackSurchargeBps,
      maxEdgeRatioThreshold: pricingObj.maxEdgeRatioThreshold,
    };
  }

  console.log('\n--- 2. SEEDING DEMO USERS & ENTERPRISES (25 MULTI-TENANT ACCOUNTS) ---');

  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const adminCompany = await client.company.upsert({
    where: { taxCode: ADMIN_COMPANY.taxCode },
    update: ADMIN_COMPANY,
    create: ADMIN_COMPANY,
  });

  for (const u of PLATFORM_ADMIN_USERS) {
    await client.user.upsert({
      where: { email: u.email },
      update: {
        companyId: adminCompany.id,
        fullName: u.fullName,
        role: u.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      create: {
        companyId: adminCompany.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });
    console.log(`✓ [PLATFORM_ADMIN] ${u.email} - ${u.fullName}`);
  }

  // Backward-compatible alias
  await client.user.upsert({
    where: { email: 'admin@logix.vn' },
    update: {
      companyId: adminCompany.id,
      fullName: 'Nguyễn Văn An (Platform Admin)',
      role: UserRole.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      companyId: adminCompany.id,
      email: 'admin@logix.vn',
      fullName: 'Nguyễn Văn An (Platform Admin)',
      role: UserRole.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  });

  const seededFwdCompanies: Record<string, any> = {};
  for (const f of FWD_COMPANIES) {
    const comp = await client.company.upsert({
      where: { taxCode: f.taxCode },
      update: {
        name: f.name,
        type: CompanyType.FWD,
        status: CompanyStatus.VERIFIED,
        address: f.address,
        phone: f.phone,
        email: f.email,
        verifiedAt: new Date(),
      },
      create: {
        taxCode: f.taxCode,
        name: f.name,
        type: CompanyType.FWD,
        status: CompanyStatus.VERIFIED,
        address: f.address,
        phone: f.phone,
        email: f.email,
        verifiedAt: new Date(),
      },
    });

    seededFwdCompanies[f.email] = comp;

    await client.user.upsert({
      where: { email: f.email },
      update: {
        companyId: comp.id,
        fullName: f.fullName,
        role: f.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      create: {
        companyId: comp.id,
        email: f.email,
        fullName: f.fullName,
        role: f.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });
    console.log(`✓ [FWD_ADMIN] ${f.email} - ${f.fullName} (${comp.name})`);
  }

  // Backward-compatible alias
  await client.user.upsert({
    where: { email: 'fwd@logix.vn' },
    update: {
      companyId: seededFwdCompanies['fwd01@logix.vn'].id,
      fullName: 'Trần Đình Trọng (Điều Phối Viên FWD)',
      role: UserRole.FWD_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      companyId: seededFwdCompanies['fwd01@logix.vn'].id,
      email: 'fwd@logix.vn',
      fullName: 'Trần Đình Trọng (Điều Phối Viên FWD)',
      role: UserRole.FWD_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  });

  const seededCfsCompanies: Record<string, any> = {};
  for (const c of CFS_COMPANIES) {
    const comp = await client.company.upsert({
      where: { taxCode: c.taxCode },
      update: {
        name: c.name,
        type: CompanyType.CFS,
        status: CompanyStatus.VERIFIED,
        address: c.address,
        phone: c.phone,
        email: c.email,
        verifiedAt: new Date(),
      },
      create: {
        taxCode: c.taxCode,
        name: c.name,
        type: CompanyType.CFS,
        status: CompanyStatus.VERIFIED,
        address: c.address,
        phone: c.phone,
        email: c.email,
        verifiedAt: new Date(),
      },
    });

    seededCfsCompanies[c.email] = comp;

    await client.user.upsert({
      where: { email: c.email },
      update: {
        companyId: comp.id,
        fullName: c.fullName,
        role: c.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      create: {
        companyId: comp.id,
        email: c.email,
        fullName: c.fullName,
        role: c.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });
    console.log(`✓ [CFS_ADMIN] ${c.email} - ${c.fullName} (${c.note})`);
  }

  const seededShipperCompanies: Record<string, any> = {};
  for (const s of SHIPPER_COMPANIES) {
    const comp = await client.company.upsert({
      where: { taxCode: s.taxCode },
      update: {
        name: s.name,
        type: CompanyType.SHIPPER,
        status: CompanyStatus.VERIFIED,
        address: s.address,
        phone: s.phone,
        email: s.email,
        verifiedAt: new Date(),
      },
      create: {
        taxCode: s.taxCode,
        name: s.name,
        type: CompanyType.SHIPPER,
        status: CompanyStatus.VERIFIED,
        address: s.address,
        phone: s.phone,
        email: s.email,
        verifiedAt: new Date(),
      },
    });

    seededShipperCompanies[s.code] = comp;

    await client.user.upsert({
      where: { email: s.email },
      update: {
        companyId: comp.id,
        fullName: s.fullName,
        role: UserRole.SHIPPER_ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      create: {
        companyId: comp.id,
        email: s.email,
        fullName: s.fullName,
        role: UserRole.SHIPPER_ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });
  }

  console.log(`✓ [SHIPPER_ADMIN] Successfully seeded all 15 shipper enterprises.`);

  console.log('\n--- 3. SEEDING 60 SHIPMENTS (4 SHIPMENTS PER SHIPPER: DRAFT, PRICED, SUBMITTED, GROUPED) ---');

  const SHIPPER_GROUPED_STOPS: Record<string, { dropOrder: number; deliveryDestination: string }> = {
    // SGN-HPH (Hải Phòng lane - 6 stops from port inland)
    S01: {
      dropOrder: 1,
      deliveryDestination: 'Kho CFS Cảng Hải Phòng (Đoạn Xá - Ngô Quyền, cách cảng 2km)',
    },
    S02: {
      dropOrder: 2,
      deliveryDestination: 'Kho CFS Logistics Đình Vũ (KCN Đình Vũ, Đông Hải 2 - 8km)',
    },
    S03: {
      dropOrder: 3,
      deliveryDestination: 'Kho ICD Nam Đình Vũ (Khu kinh tế Đình Vũ - Cát Hải - 15km)',
    },
    S04: {
      dropOrder: 4,
      deliveryDestination: 'Kho Phân Phối KCN Nomura Hải Phòng (An Dương - 22km)',
    },
    S05: {
      dropOrder: 5,
      deliveryDestination: 'Kho CFS KCN Tràng Duệ (An Dương, Hải Phòng - 28km)',
    },
    S06: {
      dropOrder: 6,
      deliveryDestination: 'Trung Tâm Tiếp Vận Lai Vu (Hải Dương, xa nhất trục QL5 - 45km)',
    },

    // SGN-DAD (Đà Nẵng lane - 5 stops)
    S07: {
      dropOrder: 1,
      deliveryDestination: 'Kho CFS Cảng Tiên Sa Đà Nẵng (gần cảng nhất - 3km)',
    },
    S08: {
      dropOrder: 2,
      deliveryDestination: 'Kho ICD KCN An Đồn (Sơn Trà, Đà Nẵng - 6km)',
    },
    S09: {
      dropOrder: 3,
      deliveryDestination: 'Kho Phân Phối KCN Hòa Cầm (Cẩm Lệ, Đà Nẵng - 14km)',
    },
    S10: {
      dropOrder: 4,
      deliveryDestination: 'Kho Trung Chuyển KCN Hòa Khánh (Liên Chiểu, Đà Nẵng - 20km)',
    },
    S11: {
      dropOrder: 5,
      deliveryDestination: 'Kho Tiếp Vận KCN Điện Nam - Điện Ngọc (Quảng Nam, xa nhất - 32km)',
    },

    // HAN-SGN (Sài Gòn lane - 5 stops)
    S12: {
      dropOrder: 1,
      deliveryDestination: 'Kho CFS Cảng Cát Lái (TP. Thủ Đức, gần cảng nhất - 2km)',
    },
    S13: {
      dropOrder: 2,
      deliveryDestination: 'Kho ICD Sotrans Thủ Đức (TP. Thủ Đức - 7km)',
    },
    S14: {
      dropOrder: 3,
      deliveryDestination: 'Kho Phân Phối KCN Sóng Thần (Dĩ An, Bình Dương - 16km)',
    },
    S15: {
      dropOrder: 4,
      deliveryDestination: 'Kho CFS KCN Tân Bình (Tân Phú, TP.HCM - 24km)',
    },
    'S01-HAN': {
      dropOrder: 5,
      deliveryDestination: 'Kho Tiếp Vận KCN Hiệp Phước (Nhà Bè, TP.HCM, xa nhất - 35km)',
    },
  };

  const groupedShipmentsByLane: Record<
    'SGN-HPH' | 'SGN-DAD' | 'HAN-SGN',
    Array<{
      shipmentId: string;
      companyId: string;
      dropOrder: number;
      deliveryDestination: string;
    }>
  > = {
    'SGN-HPH': [],
    'SGN-DAD': [],
    'HAN-SGN': [],
  };

  const shipperShipmentCounts: Record<string, number> = {};

  const statuses: ShipmentStatus[] = [
    ShipmentStatus.DRAFT,
    ShipmentStatus.PRICED,
    ShipmentStatus.SUBMITTED,
    ShipmentStatus.GROUPED,
  ];

  for (const s of SHIPPER_COMPANIES) {
    const comp = seededShipperCompanies[s.code];
    const laneObj = lanes[s.primaryLane];
    const pricingObj = await client.pricingConfig.findFirstOrThrow({
      where: { laneId: laneObj.id, effectiveTo: null },
    });
    const pricingCfg = lanePricingInputs[s.primaryLane];

    shipperShipmentCounts[s.email] = 0;

    for (const status of statuses) {
      const trackingCode = `SHP-${s.code}-${status.slice(0, 3).toUpperCase()}`;
      const packagesList = generatePackagesForShipment(s, status);

      let totalVolumeMm3 = 0n;
      let totalWeightGrams = 0n;
      let chargeableBasis = 'VOLUME';
      let baseAmount = 0n;
      let surchargedAmount = 0n;
      let totalAmount = 0n;
      let pricingSnapshot: any = null;

      if (status !== ShipmentStatus.DRAFT) {
        const pricingPkgs: PackagePricingInput[] = packagesList.map((p) => ({
          lengthMm: p.lengthMm,
          widthMm: p.widthMm,
          heightMm: p.heightMm,
          weightGrams: p.weightGrams,
          isFragile: p.isFragile,
          noStack: p.noStack,
        }));

        const calculated = calculateShipmentPricing(pricingPkgs, pricingCfg);
        totalVolumeMm3 = calculated.totalVolumeMm3;
        totalWeightGrams = calculated.totalWeightGrams;
        chargeableBasis = calculated.chargeableBasis;
        baseAmount = calculated.winningBaseAmount;
        surchargedAmount = calculated.surchargedAmount;
        totalAmount = calculated.totalAmount;
        pricingSnapshot = calculated;
      } else {
        for (const p of packagesList) {
          totalVolumeMm3 += BigInt(p.lengthMm) * BigInt(p.widthMm) * BigInt(p.heightMm);
          totalWeightGrams += BigInt(p.weightGrams);
        }
      }

      const shipment = await client.shipment.upsert({
        where: { trackingCode },
        update: {
          companyId: comp.id,
          laneId: laneObj.id,
          pricingConfigId: pricingObj.id,
          status,
          totalPackages: packagesList.length,
          volumeMm3: totalVolumeMm3,
          weightGrams: totalWeightGrams,
          chargeableBasis: chargeableBasis as any,
          baseAmount,
          surchargedAmount,
          totalAmount,
          pricingSnapshot,
        },
        create: {
          companyId: comp.id,
          laneId: laneObj.id,
          pricingConfigId: pricingObj.id,
          trackingCode,
          status,
          totalPackages: packagesList.length,
          volumeMm3: totalVolumeMm3,
          weightGrams: totalWeightGrams,
          chargeableBasis: chargeableBasis as any,
          baseAmount,
          surchargedAmount,
          totalAmount,
          pricingSnapshot,
        },
      });

      shipperShipmentCounts[s.email]++;

      const stopInfo = SHIPPER_GROUPED_STOPS[s.code] ?? {
        dropOrder: 1,
        deliveryDestination: 'Kho trung tâm',
      };

      await client.package.deleteMany({ where: { shipmentId: shipment.id } });
      const pkgRecords = packagesList.map((p, idx) => ({
        companyId: comp.id,
        shipmentId: shipment.id,
        packageCode: `${trackingCode}-P${String(idx + 1).padStart(2, '0')}`,
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        volumeMm3: BigInt(p.lengthMm) * BigInt(p.widthMm) * BigInt(p.heightMm),
        weightGrams: p.weightGrams,
        isFragile: p.isFragile,
        noStack: p.noStack,
        packageType: PackageType.BOX,
        dropOrder: status === ShipmentStatus.GROUPED ? stopInfo.dropOrder : 1,
      }));
      await client.package.createMany({ data: pkgRecords });

      if (status === ShipmentStatus.GROUPED) {
        groupedShipmentsByLane[s.primaryLane].push({
          shipmentId: shipment.id,
          companyId: comp.id,
          dropOrder: stopInfo.dropOrder,
          deliveryDestination: stopInfo.deliveryDestination,
        });
      }
    }

    console.log(`✓ Shipper ${s.code} (${s.email}) seeded 4 shipments (DRAFT, PRICED, SUBMITTED, GROUPED).`);
  }

  // Add 1 secondary grouped shipment from S01 to HAN-SGN lane to give HAN-SGN 5 distinct shippers
  const s01Comp = seededShipperCompanies['S01'];
  const hanSgnLane = lanes['HAN-SGN'];
  const hanSgnPricing = await client.pricingConfig.findFirstOrThrow({
    where: { laneId: hanSgnLane.id, effectiveTo: null },
  });
  const hanSgnPkgs = generatePackagesForShipment(SHIPPER_COMPANIES[0], ShipmentStatus.GROUPED);
  const hanSgnPricingResult = calculateShipmentPricing(
    hanSgnPkgs.map((p) => ({
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      weightGrams: p.weightGrams,
      isFragile: p.isFragile,
      noStack: p.noStack,
    })),
    lanePricingInputs['HAN-SGN'],
  );

  const extraTrackingCode = 'SHP-S01-HAN-GRP';
  const extraShipment = await client.shipment.upsert({
    where: { trackingCode: extraTrackingCode },
    update: {
      companyId: s01Comp.id,
      laneId: hanSgnLane.id,
      pricingConfigId: hanSgnPricing.id,
      status: ShipmentStatus.GROUPED,
      totalPackages: hanSgnPkgs.length,
      volumeMm3: hanSgnPricingResult.totalVolumeMm3,
      weightGrams: hanSgnPricingResult.totalWeightGrams,
      chargeableBasis: hanSgnPricingResult.chargeableBasis as any,
      baseAmount: hanSgnPricingResult.winningBaseAmount,
      surchargedAmount: hanSgnPricingResult.surchargedAmount,
      totalAmount: hanSgnPricingResult.totalAmount,
      pricingSnapshot: hanSgnPricingResult as any,
    },
    create: {
      companyId: s01Comp.id,
      laneId: hanSgnLane.id,
      pricingConfigId: hanSgnPricing.id,
      trackingCode: extraTrackingCode,
      status: ShipmentStatus.GROUPED,
      totalPackages: hanSgnPkgs.length,
      volumeMm3: hanSgnPricingResult.totalVolumeMm3,
      weightGrams: hanSgnPricingResult.totalWeightGrams,
      chargeableBasis: hanSgnPricingResult.chargeableBasis as any,
      baseAmount: hanSgnPricingResult.winningBaseAmount,
      surchargedAmount: hanSgnPricingResult.surchargedAmount,
      totalAmount: hanSgnPricingResult.totalAmount,
      pricingSnapshot: hanSgnPricingResult as any,
    },
  });

  const stopInfoExtra = SHIPPER_GROUPED_STOPS['S01-HAN'];
  await client.package.deleteMany({ where: { shipmentId: extraShipment.id } });
  await client.package.createMany({
    data: hanSgnPkgs.map((p, idx) => ({
      companyId: s01Comp.id,
      shipmentId: extraShipment.id,
      packageCode: `${extraTrackingCode}-P${String(idx + 1).padStart(2, '0')}`,
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      volumeMm3: BigInt(p.lengthMm) * BigInt(p.widthMm) * BigInt(p.heightMm),
      weightGrams: p.weightGrams,
      isFragile: p.isFragile,
      noStack: p.noStack,
      packageType: PackageType.BOX,
      dropOrder: stopInfoExtra.dropOrder,
    })),
  });
  groupedShipmentsByLane['HAN-SGN'].push({
    shipmentId: extraShipment.id,
    companyId: s01Comp.id,
    dropOrder: stopInfoExtra.dropOrder,
    deliveryDestination: stopInfoExtra.deliveryDestination,
  });
  shipperShipmentCounts['shipper01@logix.vn']++;

  console.log('\n--- 4. SEEDING 3 CONFIRMED MATCH GROUPS ACROSS 3 CANONICAL LANES ---');

  const container40HC = await client.containerType.findUniqueOrThrow({
    where: { code: '40HC' },
  });
  const contVolumeMm3 = BigInt(container40HC.volumeMm3);
  const contMaxPayload = BigInt(container40HC.maxPayloadGram);

  const matchGroupConfigs = [
    {
      code: 'MG-DEMO-40HC-01',
      laneCode: 'SGN-HPH' as const,
      name: 'Nhóm Ghép Cont Sài Gòn - Hải Phòng (6 Chủ hàng)',
      status: MatchGroupStatus.CONFIRMED,
      shipments: groupedShipmentsByLane['SGN-HPH'],
    },
    {
      code: 'MG-DEMO-40HC-02',
      laneCode: 'SGN-DAD' as const,
      name: 'Nhóm Ghép Cont Sài Gòn - Đà Nẵng (5 Chủ hàng)',
      status: MatchGroupStatus.CONFIRMED,
      shipments: groupedShipmentsByLane['SGN-DAD'],
    },
    {
      code: 'MG-DEMO-40HC-03',
      laneCode: 'HAN-SGN' as const,
      name: 'Nhóm Ghép Cont Hà Nội - Sài Gòn (5 Chủ hàng)',
      status: MatchGroupStatus.PROPOSED,
      shipments: groupedShipmentsByLane['HAN-SGN'],
    },
  ];

  const seededMatchGroups: any[] = [];

  for (const mgCfg of matchGroupConfigs) {
    const laneObj = lanes[mgCfg.laneCode];

    const shpRecords = await client.shipment.findMany({
      where: { id: { in: mgCfg.shipments.map((s) => s.shipmentId) } },
      select: { volumeMm3: true, weightGrams: true },
    });

    let aggVolMm3 = 0n;
    let aggWtGrams = 0n;
    for (const shp of shpRecords) {
      aggVolMm3 += BigInt(shp.volumeMm3);
      aggWtGrams += BigInt(shp.weightGrams);
    }

    const volumeFillBps = Math.round(Number((aggVolMm3 * 10000n) / contVolumeMm3));
    const weightFillBps = Math.round(Number((aggWtGrams * 10000n) / contMaxPayload));
    const cutoffTime = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const mg = await client.matchGroup.upsert({
      where: { code: mgCfg.code },
      update: {
        laneId: laneObj.id,
        targetContainerTypeId: container40HC.id,
        status: mgCfg.status,
        cutoffTime,
        totalCbmMm3: aggVolMm3,
        totalWeightGrams: aggWtGrams,
        volumeFillBps,
        weightFillBps,
      },
      create: {
        code: mgCfg.code,
        laneId: laneObj.id,
        targetContainerTypeId: container40HC.id,
        status: mgCfg.status,
        cutoffTime,
        totalCbmMm3: aggVolMm3,
        totalWeightGrams: aggWtGrams,
        volumeFillBps,
        weightFillBps,
      },
    });

    await client.matchGroupShipment.deleteMany({
      where: { matchGroupId: mg.id },
    });

    await client.matchGroupShipment.createMany({
      data: mgCfg.shipments.map((s) => ({
        companyId: s.companyId,
        matchGroupId: mg.id,
        shipmentId: s.shipmentId,
        dropOrder: s.dropOrder,
        deliveryDestination: s.deliveryDestination,
      })),
    });

    await client.booking.deleteMany({ where: { matchGroupId: mg.id } });
    await client.quote.deleteMany({ where: { matchGroupId: mg.id } });

    if (mgCfg.code === 'MG-DEMO-40HC-01') {
      const fwd1 = seededFwdCompanies['fwd01@logix.vn'];
      const cfs1 = seededCfsCompanies['cfs01@logix.vn'];
      if (fwd1) {
        const quote1 = await client.quote.create({
          data: {
            matchGroupId: mg.id,
            fwdCompanyId: fwd1.id,
            status: QuoteStatus.ACCEPTED,
            oceanFreight: 26_000_000n,
            handlingFee: 2_500_000n,
            documentationFee: 800_000n,
            surcharges: 700_000n,
            vatRateBps: 1000,
            vatAmount: 3_000_000n,
            totalAmount: 33_000_000n,
            transitDays: 3,
            validUntil: new Date(Date.now() + 86400000 * 7),
            notes: 'Báo giá trọn gói tuyến SGN-HPH, cam kết thời gian dỡ cont 24h',
          },
        });

        const bkg1 = await client.booking.create({
          data: {
            bookingNumber: 'BKG-260918-001',
            matchGroupId: mg.id,
            quoteId: quote1.id,
            fwdCompanyId: fwd1.id,
            cfsCompanyId: cfs1?.id || null,
            status: BookingStatus.SEALED,
            totalAmount: 33_000_000n,
            containerNo: 'TCLU-892145-2',
            sealNo: 'VN-HP-00892',
            sealedAt: new Date(),
            notes: 'Booking cont 40HC đã hoàn tất xếp hàng, đóng cont và niêm chì hải quan tại CFS Tân Vũ',
            confirmedAt: new Date(),
          },
        });
        console.log(`  ✓ Seeded Quote & SEALED Booking BKG-260918-001 for ${mg.code} (FWD: ${fwd1.name})`);

        await client.matchGroupShipment.updateMany({
          where: { matchGroupId: mg.id },
          data: {
            tallyStatus: 'VERIFIED',
            tallyAt: new Date(),
          },
        });

        // Seed sample LoadingProofs to MinIO and Database
        try {
          const s3 = new S3Client({
            endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
            region: 'us-east-1',
            forcePathStyle: true,
            credentials: {
              accessKeyId: process.env.MINIO_ROOT_USER || 'logix_minio_admin',
              secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'logix_minio_secret_key',
            },
          });
          const bucket = process.env.MINIO_BUCKET_PROOFS || 'loading-proofs';

          // Upload files to MinIO
          const keyInbound = `proofs/${bkg1.id}/inbound-demo-01.png`;
          const keyLayer1 = `proofs/${bkg1.id}/layer-1-demo.png`;
          const keyLayer2 = `proofs/${bkg1.id}/layer-2-demo.png`;
          const keySeal = `proofs/${bkg1.id}/seal-closed-demo.png`;

          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: keyInbound, Body: SAMPLE_PROOF_PNG, ContentType: 'image/png' }));
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: keyLayer1, Body: SAMPLE_PROOF_PNG, ContentType: 'image/png' }));
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: keyLayer2, Body: SAMPLE_PROOF_PNG, ContentType: 'image/png' }));
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: keySeal, Body: SAMPLE_PROOF_PNG, ContentType: 'image/png' }));

          const firstMgs = await client.matchGroupShipment.findFirst({ where: { matchGroupId: mg.id } });

          await client.loadingProof.createMany({
            data: [
              {
                bookingId: bkg1.id,
                matchGroupId: mg.id,
                shipmentId: firstMgs?.shipmentId || null,
                companyId: cfs1?.id || fwd1.id,
                proofType: LoadingProofType.INBOUND_INSPECTION,
                fileKey: keyInbound,
                fileName: 'inbound-kiem-dem-tan-vu.png',
                fileSize: SAMPLE_PROOF_PNG.length,
                mimeType: 'image/png',
                notes: 'Kiểm kiện tại cổng kho CFS Tân Vũ: 10/10 kiện nguyên đai nguyên kiện',
              },
              {
                bookingId: bkg1.id,
                matchGroupId: mg.id,
                companyId: cfs1?.id || fwd1.id,
                proofType: LoadingProofType.LAYER_PACKED,
                layerIndex: 1,
                fileKey: keyLayer1,
                fileName: 'layer-1-day-cont.png',
                fileSize: SAMPLE_PROOF_PNG.length,
                mimeType: 'image/png',
                notes: 'Nghiệm thu lớp 1: Kiện hàng nặng máy móc và phụ tùng sàn cont',
              },
              {
                bookingId: bkg1.id,
                matchGroupId: mg.id,
                companyId: cfs1?.id || fwd1.id,
                proofType: LoadingProofType.LAYER_PACKED,
                layerIndex: 2,
                fileKey: keyLayer2,
                fileName: 'layer-2-chen-lot.png',
                fileSize: SAMPLE_PROOF_PNG.length,
                mimeType: 'image/png',
                notes: 'Nghiệm thu lớp 2: Thùng carton may mặc, chèn lót túi khí an toàn',
              },
              {
                bookingId: bkg1.id,
                matchGroupId: mg.id,
                companyId: cfs1?.id || fwd1.id,
                proofType: LoadingProofType.SEAL_CLOSED,
                fileKey: keySeal,
                fileName: 'seal-niem-chi-hai-quan.png',
                fileSize: SAMPLE_PROOF_PNG.length,
                mimeType: 'image/png',
                notes: 'Niêm phong kẹp chì hải quan VN-HP-00892, cont TCLU-892145-2 hoàn tất đóng kín',
              },
            ],
          });
          console.log(`  ✓ Seeded 4 sample Loading Proofs (MinIO + DB) for ${bkg1.bookingNumber}`);
        } catch (err: any) {
          console.warn(`  ⚠ Could not seed MinIO proofs: ${err.message}`);
        }
      }
    } else if (mgCfg.code === 'MG-DEMO-40HC-02') {
      const fwd2 = seededFwdCompanies['fwd02@logix.vn'];
      const cfs3 = seededCfsCompanies['cfs03@logix.vn'];
      if (fwd2) {
        const quote2 = await client.quote.create({
          data: {
            matchGroupId: mg.id,
            fwdCompanyId: fwd2.id,
            status: QuoteStatus.ACCEPTED,
            oceanFreight: 20_000_000n,
            handlingFee: 2_000_000n,
            documentationFee: 600_000n,
            surcharges: 400_000n,
            vatRateBps: 1000,
            vatAmount: 2_300_000n,
            totalAmount: 25_300_000n,
            transitDays: 2,
            validUntil: new Date(Date.now() + 86400000 * 7),
            notes: 'Báo giá tuyến SGN-DAD, kèm bảo hiểm hàng hải cơ bản',
          },
        });

        await client.booking.create({
          data: {
            bookingNumber: 'BKG-260918-002',
            matchGroupId: mg.id,
            quoteId: quote2.id,
            fwdCompanyId: fwd2.id,
            cfsCompanyId: cfs3?.id || null,
            status: BookingStatus.CONFIRMED,
            totalAmount: 25_300_000n,
            notes: 'Booking cont 40HC đã xác nhận tuyến Đà Nẵng',
            confirmedAt: new Date(),
          },
        });
        console.log(`  ✓ Seeded Quote & Booking BKG-260918-002 for ${mg.code} (FWD: ${fwd2.name})`);
      }
    } else if (mgCfg.code === 'MG-DEMO-40HC-03') {
      const fwd3 = seededFwdCompanies['fwd03@logix.vn'];
      const fwd4 = seededFwdCompanies['fwd04@logix.vn'];
      if (fwd3) {
        await client.quote.create({
          data: {
            matchGroupId: mg.id,
            fwdCompanyId: fwd3.id,
            status: QuoteStatus.PENDING,
            oceanFreight: 28_000_000n,
            handlingFee: 3_000_000n,
            documentationFee: 800_000n,
            surcharges: 1_200_000n,
            vatRateBps: 1000,
            vatAmount: 3_300_000n,
            totalAmount: 36_300_000n,
            transitDays: 4,
            validUntil: new Date(Date.now() + 86400000 * 5),
            notes: 'Báo giá FWD Đại Dương: tuyến HAN-SGN, thời gian hành trình 4 ngày',
          },
        });
        console.log(`  ✓ Seeded PENDING Quote for ${mg.code} (FWD: ${fwd3.name}) [Sẵn sàng bấm Chốt booking]`);
      }

      if (fwd4) {
        await client.quote.create({
          data: {
            matchGroupId: mg.id,
            fwdCompanyId: fwd4.id,
            status: QuoteStatus.PENDING,
            oceanFreight: 27_000_000n,
            handlingFee: 3_200_000n,
            documentationFee: 800_000n,
            surcharges: 1_000_000n,
            vatRateBps: 1000,
            vatAmount: 3_200_000n,
            totalAmount: 35_200_000n,
            transitDays: 3,
            validUntil: new Date(Date.now() + 86400000 * 5),
            notes: 'Báo giá FWD Phương Đông: giá cạnh tranh, ưu tiên giao hàng nhanh 3 ngày',
          },
        });
        console.log(`  ✓ Seeded competing PENDING Quote for ${mg.code} (FWD: ${fwd4.name})`);
      }
    }

    seededMatchGroups.push({
      ...mg,
      status: mgCfg.status,
      laneCode: mgCfg.laneCode,
      shipperCount: mgCfg.shipments.length,
      volCbm: (Number(aggVolMm3) / 1e9).toFixed(2),
      volFillPct: (volumeFillBps / 100).toFixed(1),
      wtKg: (Number(aggWtGrams) / 1000).toLocaleString(),
      wtFillPct: (weightFillBps / 100).toFixed(1),
    });

    console.log(`✓ MatchGroup ${mg.code} (${mgCfg.laneCode}) [${mgCfg.status}]: ${mgCfg.shipments.length} Shippers, ${(Number(aggVolMm3)/1e9).toFixed(2)} m³ (${(volumeFillBps/100).toFixed(1)}% 40HC), ${(Number(aggWtGrams)/1000).toLocaleString()} kg`);
  }

  console.log('\n====================================================================================================');
  console.log('                          DANH SÁCH 25 TÀI KHOẢN DEMO ĐỘC LẬP (LOGIX PLATFORM)                      ');
  console.log('====================================================================================================');
  console.log(`Mật khẩu dùng chung cho TẤT CẢ tài khoản: ${DEMO_PASSWORD}`);
  console.log('----------------------------------------------------------------------------------------------------');
  console.log(
    'STT'.padEnd(4) +
    '| ' + 'Email'.padEnd(20) +
    '| ' + 'Vai Trò'.padEnd(16) +
    '| ' + 'Họ Tên'.padEnd(30) +
    '| ' + 'Doanh Nghiệp / Đơn Vị'.padEnd(45) +
    '| ' + 'Lô Hàng'.padEnd(8)
  );
  console.log('-'.repeat(128));

  let counter = 1;
  const allAccountRows: Array<{
    stt: number;
    email: string;
    role: string;
    fullName: string;
    companyName: string;
    industry: string;
    lane: string;
    shipmentCount: number;
    note: string;
  }> = [];

  for (const u of PLATFORM_ADMIN_USERS) {
    console.log(
      String(counter).padEnd(4) +
      '| ' + u.email.padEnd(20) +
      '| ' + 'PLATFORM_ADMIN'.padEnd(16) +
      '| ' + u.fullName.slice(0, 28).padEnd(30) +
      '| ' + ADMIN_COMPANY.name.slice(0, 43).padEnd(45) +
      '| ' + '-'.padEnd(8)
    );
    allAccountRows.push({
      stt: counter++,
      email: u.email,
      role: 'PLATFORM_ADMIN',
      fullName: u.fullName,
      companyName: ADMIN_COMPANY.name,
      industry: 'Quản trị Nền tảng',
      lane: 'Toàn quốc',
      shipmentCount: 0,
      note: 'Toàn quyền kiểm duyệt công ty, giám sát KPI toàn hệ thống',
    });
  }

  for (const f of FWD_COMPANIES) {
    console.log(
      String(counter).padEnd(4) +
      '| ' + f.email.padEnd(20) +
      '| ' + 'FWD_ADMIN'.padEnd(16) +
      '| ' + f.fullName.slice(0, 28).padEnd(30) +
      '| ' + f.name.slice(0, 43).padEnd(45) +
      '| ' + '-'.padEnd(8)
    );
    allAccountRows.push({
      stt: counter++,
      email: f.email,
      role: 'FWD_ADMIN',
      fullName: f.fullName,
      companyName: f.name,
      industry: 'Giao nhận Tiếp vận (Forwarder)',
      lane: 'Đa tuyến',
      shipmentCount: 0,
      note: 'Điều phối viên FWD, tạo và chốt kế hoạch đóng ghép container',
    });
  }

  for (const c of CFS_COMPANIES) {
    console.log(
      String(counter).padEnd(4) +
      '| ' + c.email.padEnd(20) +
      '| ' + 'CFS_ADMIN'.padEnd(16) +
      '| ' + c.fullName.slice(0, 28).padEnd(30) +
      '| ' + c.name.slice(0, 43).padEnd(45) +
      '| ' + '-'.padEnd(8)
    );
    allAccountRows.push({
      stt: counter++,
      email: c.email,
      role: 'CFS_ADMIN',
      fullName: c.fullName,
      companyName: c.name,
      industry: 'Kho vận CFS',
      lane: c.note.split('-')[0].trim(),
      shipmentCount: 0,
      note: c.note,
    });
  }

  for (const s of SHIPPER_COMPANIES) {
    const shpCount = shipperShipmentCounts[s.email] || 4;
    console.log(
      String(counter).padEnd(4) +
      '| ' + s.email.padEnd(20) +
      '| ' + 'SHIPPER_ADMIN'.padEnd(16) +
      '| ' + s.fullName.slice(0, 28).padEnd(30) +
      '| ' + s.name.slice(0, 43).padEnd(45) +
      '| ' + `${shpCount} lô`.padEnd(8)
    );
    allAccountRows.push({
      stt: counter++,
      email: s.email,
      role: 'SHIPPER_ADMIN',
      fullName: s.fullName,
      companyName: s.name,
      industry: s.industry,
      lane: s.primaryLane,
      shipmentCount: shpCount,
      note: `Có sẵn 4 lô hàng (DRAFT, PRICED, SUBMITTED, GROUPED)`,
    });
  }

  console.log('----------------------------------------------------------------------------------------------------');
  console.log('CÁC NHÓM GHÉP CONTAINER 3D ĐÃ SẴN SÀNG TRẢI NGHIỆM:');
  for (const mg of seededMatchGroups) {
    console.log(`- [${mg.laneCode}] ${mg.code}: /match-groups/${mg.id} (${mg.shipperCount} chủ hàng, ${mg.volCbm} m³, lấp đầy ${mg.volFillPct}%)`);
  }
  console.log('====================================================================================================\n');

  const docsDir = path.resolve(__dirname, '../../../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  let mdContent = `# DANH SÁCH TÀI KHOẢN VÀ DỮ LIỆU DEMO NỀN TẢNG LOGIX-3D

Tài liệu này cung cấp đầy đủ thông tin tài khoản đăng nhập và dữ liệu mẫu độc lập dành cho ban thẩm định và người dùng thử nghiệm hệ thống **LOGIX-3D Logistics Platform**.

---

## 1. THÔNG TIN ĐĂNG NHẬP CHUNG

- **Địa chỉ truy cập Web:** [http://localhost:3000/login](http://localhost:3000/login)
- **Mật khẩu dùng chung cho TẤT CẢ tài khoản:** \`${DEMO_PASSWORD}\`
- **Cơ chế phân quyền:** Hệ thống tự động cách ly dữ liệu giữa các doanh nghiệp (Multi-tenant Data Isolation). Mỗi người thử nghiệm đăng nhập bằng tài khoản riêng sẽ làm việc trên dữ liệu độc lập của doanh nghiệp mình, không lo bị trùng lặp hay ghi đè.

---

## 2. BẢNG TỔNG HỢP 25 TÀI KHOẢN DEMO

| STT | Email Đăng Nhập | Mật Khẩu | Vai Trò Hệ Thống | Người Đại Diện / Chức Danh | Doanh Nghiệp / Đơn Vị | Ngành Nghề & Tuyến | Số Lô Hàng Sẵn Có |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
`;

  for (const r of allAccountRows) {
    mdContent += `| **${r.stt}** | \`${r.email}\` | \`${DEMO_PASSWORD}\` | \`${r.role}\` | ${r.fullName} | **${r.companyName}** | ${r.industry} *(${r.lane})* | **${r.shipmentCount > 0 ? `${r.shipmentCount} lô` : '—'}** |\n`;
  }

  mdContent += `
---

## 3. DANH SÁCH 3 KẾ HOẠCH GOM HÀNG 3D CONTAINER (DEMO)

Các nhóm ghép container này đã được gom sẵn từ các lô hàng trạng thái \`GROUPED\` của **4 đến 6 chủ hàng khác nhau**. Khi mở màn hình 3D, các kiện hàng sẽ được phân biệt bằng **các màu sắc chủ hàng khác nhau** tương ứng trong bảng màu 12 chủ hàng chuẩn (*docs/design-spec.md*):

| Tuyến Đường | Mã Nhóm Ghép Cont | Trạng Thái | Số Chủ Hàng Gom Chung | Thể Tích / Tỷ Lệ Lấp Đầy | Tải Trọng / Tỷ Lệ | Đường Dẫn Xem Khung 3D |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
`;

  for (const mg of seededMatchGroups) {
    mdContent += `| **${mg.laneCode}** | \`${mg.code}\` | **${mg.status}** | **${mg.shipperCount} chủ hàng** | ${mg.volCbm} m³ (${mg.volFillPct}%) | ${mg.wtKg} kg (${mg.wtFillPct}%) | [/match-groups/${mg.id}](http://localhost:3000/match-groups/${mg.id}) |\n`;
  }

  mdContent += `
---

## 4. HƯỚNG DẪN TRẢI NGHIỆM CHI TIẾT THEO VAI TRÒ

### A. Dành cho Chủ Hàng (Shipper — \`shipper01@logix.vn\` đến \`shipper15@logix.vn\`)
1. Đăng nhập với tài khoản shipper bất kỳ (VD: \`shipper01@logix.vn\`).
2. Xem **Bảng điều khiển** (\`/dashboard/shipper\`): Thống kê tổng số lô hàng, thể tích CBM, cước phí.
3. Vào **Quản lý Lô hàng** (\`/shipments\`): Lọc qua 4 tab trạng thái:
   - **Bản nháp (DRAFT):** Lô hàng mới tạo chưa đủ kiện.
   - **Đã tính cước (PRICED):** Lô hàng đã nhập đầy đủ kích thước, khối lượng và tự động tính cước realtime.
   - **Chờ ghép (SUBMITTED):** Lô hàng đã gửi lên sàn, đang chờ FWD điều phối vào cont.
   - **Đã vào nhóm (GROUPED):** Lô hàng đã được xếp vào nhóm ghép container 40HC.
4. Bấm **"Tạo lô hàng mới"** (\`/shipments/new\`):
   - Bước 1: Chọn tuyến đường (\`SGN-HPH\`, \`SGN-DAD\`, \`HAN-SGN\`).
   - Bước 2: Nhập kiện hàng (hỗ trợ nhập tay hoặc tải file mẫu Excel). Kiểm tra tính năng chặn kiện kích thước 0.
   - Bước 3: Xem báo giá tức thời theo công thức chuẩn $P_{total} = \\max(V \\cdot P_v, W \\cdot P_w) \\cdot H_g + P_{fixed}$.
   - Bước 4: Hoàn tất tạo vận đơn.

### B. Dành cho Công ty Giao Nhận (Forwarder — \`fwd01@logix.vn\` đến \`fwd05@logix.vn\`)
1. Đăng nhập với tài khoản FWD (VD: \`fwd01@logix.vn\`).
2. Vào **Ghép Hàng & Consol** (\`/match-groups\`): Xem danh sách 3 nhóm ghép container 40HC trên 3 tuyến đường.
3. Bấm vào chi tiết nhóm ghép (VD: \`MG-DEMO-40HC-01\`):
   - Xem đồng hồ đo lấp đầy thể tích (Volume Gauge) và tải trọng (Weight Gauge).
   - Xem **Khung nhìn mô phỏng 3D Container (Three.js)**: Các khối hàng hiển thị nhiều màu sắc đại diện cho các chủ hàng khác nhau.
   - Thử các chế độ nhìn: Isometric, Top-view (chiếu bằng), Side-view (hông), Front-view (cửa cont).
   - Bấm vào kiện hàng bất kỳ trên không gian 3D để xem thẻ chi tiết kiện (kích thước, chủ hàng, tọa độ $x, y, z$, thứ tự dỡ hàng LIFO).
   - Xem đồ thị trọng tâm CoG an toàn $45\\%\\text{--}55\\%$.

### C. Dành cho Quản Trị Kho Hàng (CFS Operator — \`cfs01@logix.vn\` đến \`cfs03@logix.vn\`)
1. Đăng nhập với tài khoản CFS (\`cfs01@logix.vn\` - Kho CFS Tân Vũ Hải Phòng; \`cfs02@logix.vn\` - Kho CFS Cát Lái TP.HCM; \`cfs03@logix.vn\` - Kho CFS Tiên Sa Đà Nẵng).
2. Vào bảng điều khiển kho CFS (\`/dashboard/cfs\`): Theo dõi tiến độ gom hàng và kế hoạch xuất nhập kho container.

### D. Dành cho Quản Trị Hệ Thống (Platform Admin — \`admin01@logix.vn\` hoặc \`admin02@logix.vn\`)
1. Đăng nhập với tài khoản Platform Admin (\`admin01@logix.vn\`).
2. Vào **Quản trị Doanh nghiệp** (\`/dashboard/admin\`):
   - Danh sách toàn bộ 25 doanh nghiệp trên sàn.
   - Thao tác phê duyệt hoặc tạm ngưng trạng thái doanh nghiệp (\`VERIFIED\` / \`SUSPENDED\`).
   - Giám sát luồng vận hành toàn hệ thống.

---
*Tài liệu tự động tạo bởi script seed dữ liệu của LOGIX-3D Engine.*
`;

  const mdFilePath = path.join(docsDir, 'demo-accounts.md');
  fs.writeFileSync(mdFilePath, mdContent, 'utf-8');
  console.log(`✓ Generated documentation file: ${mdFilePath}`);

  return {
    lanes,
    adminCompany,
    seededMatchGroups,
  };
}

async function main() {
  try {
    await seedDemoData();
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
