import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Canonical codes and identifiers that MUST NEVER be deleted
const CANONICAL_LANE_CODES = ['SGN-HPH', 'SGN-DAD', 'HAN-SGN'];
const CANONICAL_CONTAINER_CODES = ['20DC', '40DC', '40HC'];
const CANONICAL_MATCH_GROUP_CODES = [
  'MG-DEMO-40HC-01',
  'MG-DEMO-40HC-02',
  'MG-DEMO-40HC-03',
];

export async function cleanTestData() {
  console.log('====================================================');
  console.log('        LOGIX-3D: PURGING LEAKED TEST DATA          ');
  console.log('====================================================\n');

  // 1. Identify test companies
  const testCompanies = await prisma.company.findMany({
    where: {
      OR: [
        { taxCode: { startsWith: 'TAX-' } },
        { name: { contains: 'Test' } },
        { name: { contains: '1789' } },
        { name: { contains: 'Alpha Corp' } },
        { name: { contains: 'Beta Logistics' } },
        { name: { contains: 'Gamma Trading' } },
        { name: { contains: 'Delta Logistics' } },
      ],
    },
    select: { id: true, name: true, taxCode: true },
  });

  const testCompanyIds = testCompanies.map((c) => c.id);
  console.log(`Found ${testCompanies.length} test companies to clean up.`);

  // 2. Identify test match groups
  const testMatchGroups = await prisma.matchGroup.findMany({
    where: {
      OR: [
        { code: { startsWith: 'MG-TEST' } },
        { code: { startsWith: 'MG2609' } },
        {
          AND: [
            { code: { notIn: CANONICAL_MATCH_GROUP_CODES } },
            {
              OR: [
                { matchGroupShipments: { some: { companyId: { in: testCompanyIds } } } },
                { totalCbmMm3: 0n },
              ],
            },
          ],
        },
      ],
    },
    select: { id: true, code: true },
  });

  const testMatchGroupIds = testMatchGroups.map((m) => m.id);
  console.log(`Found ${testMatchGroups.length} test match groups to clean up.`);

  // 3. Delete Bookings and Quotes associated with test match groups or test companies
  const delBookings = await prisma.booking.deleteMany({
    where: {
      OR: [
        { matchGroupId: { in: testMatchGroupIds } },
        { fwdCompanyId: { in: testCompanyIds } },
        { bookingNumber: { startsWith: 'BKG-TEST' } },
        { bookingNumber: { startsWith: 'BKG2609' } },
      ],
    },
  });
  console.log(`✓ Deleted ${delBookings.count} test bookings.`);

  const delQuotes = await prisma.quote.deleteMany({
    where: {
      OR: [
        { matchGroupId: { in: testMatchGroupIds } },
        { fwdCompanyId: { in: testCompanyIds } },
      ],
    },
  });
  console.log(`✓ Deleted ${delQuotes.count} test quotes.`);

  // 4. Delete MatchGroupShipments for test match groups or test companies
  const delMgs = await prisma.matchGroupShipment.deleteMany({
    where: {
      OR: [
        { matchGroupId: { in: testMatchGroupIds } },
        { companyId: { in: testCompanyIds } },
      ],
    },
  });
  console.log(`✓ Deleted ${delMgs.count} test match group shipments.`);

  // 5. Delete Test MatchGroups
  const delMg = await prisma.matchGroup.deleteMany({
    where: { id: { in: testMatchGroupIds } },
  });
  console.log(`✓ Deleted ${delMg.count} test match groups.`);

  // 6. Delete Packages and Shipments of test companies or test tracking codes
  const delPkgs = await prisma.package.deleteMany({
    where: {
      OR: [
        { companyId: { in: testCompanyIds } },
        { packageCode: { contains: 'TEST' } },
        { shipment: { trackingCode: { startsWith: 'TRK-' } } },
        { shipment: { trackingCode: { startsWith: 'SHP-2026' } } },
      ],
    },
  });
  console.log(`✓ Deleted ${delPkgs.count} test packages.`);

  const delShipments = await prisma.shipment.deleteMany({
    where: {
      OR: [
        { companyId: { in: testCompanyIds } },
        { trackingCode: { startsWith: 'TRK-' } },
        { trackingCode: { startsWith: 'SHP-2026' } },
      ],
    },
  });
  console.log(`✓ Deleted ${delShipments.count} test shipments.`);

  // 7. Delete Users and Refresh Tokens of test companies
  const delTokens = await prisma.refreshToken.deleteMany({
    where: {
      user: {
        OR: [
          { companyId: { in: testCompanyIds } },
          { email: { contains: 'example.com' } },
          { email: { contains: 'test' } },
        ],
      },
    },
  });
  console.log(`✓ Deleted ${delTokens.count} test refresh tokens.`);

  const delUsers = await prisma.user.deleteMany({
    where: {
      OR: [
        { companyId: { in: testCompanyIds } },
        { email: { contains: 'example.com' } },
        { email: { contains: 'test' } },
      ],
    },
  });
  console.log(`✓ Deleted ${delUsers.count} test users.`);

  // 8. Delete Test Companies
  const delCompanies = await prisma.company.deleteMany({
    where: { id: { in: testCompanyIds } },
  });
  console.log(`✓ Deleted ${delCompanies.count} test companies.`);

  // 9. Clean up any obsolete duplicate test lanes (e.g. LANE-1789...)
  const obsoleteLanes = await prisma.lane.findMany({
    where: { code: { notIn: CANONICAL_LANE_CODES } },
    select: { id: true, code: true },
  });

  if (obsoleteLanes.length > 0) {
    const obsIds = obsoleteLanes.map((l) => l.id);
    await prisma.pricingConfig.deleteMany({ where: { laneId: { in: obsIds } } });
    const delLanes = await prisma.lane.deleteMany({ where: { id: { in: obsIds } } });
    console.log(`✓ Deleted ${delLanes.count} obsolete test lanes.`);
  }

  console.log('\n✅ Database test data cleanup completed successfully.');
}

if (require.main === module) {
  cleanTestData()
    .catch((err) => {
      console.error('Error cleaning test data:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
