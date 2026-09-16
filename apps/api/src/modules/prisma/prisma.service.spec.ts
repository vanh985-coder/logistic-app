import { PrismaService } from './prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TenantContextMissingException } from '../../common/tenant/tenant-context-missing.exception';

describe('PrismaService - Multi-Tenant Security Extensions', () => {
  let prismaService: PrismaService;
  let tenantContextService: TenantContextService;

  beforeEach(() => {
    tenantContextService = new TenantContextService();
    prismaService = new PrismaService(tenantContextService);
  });

  afterAll(async () => {
    await prismaService.onModuleDestroy();
  });

  it('should THROW TenantContextMissingException when querying User without tenant context', async () => {
    await expect((prismaService as any).user.findMany()).rejects.toThrow(
      TenantContextMissingException,
    );
  });

  it('should THROW TenantContextMissingException when querying Company without tenant context', async () => {
    await expect((prismaService as any).company.findFirst()).rejects.toThrow(
      TenantContextMissingException,
    );
  });

  it('should allow unsafeGlobal to query even without tenant context', async () => {
    // unsafeGlobal should not throw TenantContextMissingException
    const result = await prismaService.unsafeGlobal.company.findMany({
      take: 1,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
