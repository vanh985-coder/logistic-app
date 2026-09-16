import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../../common/tenant/tenant.service';
import { CompanyStatus } from '@logix/shared';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async findAll() {
    return (this.prisma as any).company.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        taxCode: true,
        type: true,
        status: true,
        representativeName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const company = await (this.prisma as any).company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        taxCode: true,
        type: true,
        status: true,
        representativeName: true,
        email: true,
        phone: true,
        address: true,
        website: true,
        createdAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${id}' not found`);
    }

    return company;
  }

  /**
   * Updates company status (e.g. approve/reject/suspend).
   * Restricted to PLATFORM_ADMIN.
   * Immediately invalidates all cached user tenant contexts for this company in Redis.
   */
  async updateStatus(id: string, status: CompanyStatus) {
    // Check existence using unsafeGlobal
    const existing = await this.prisma.unsafeGlobal.company.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Company with ID '${id}' not found`);
    }

    const updated = await this.prisma.unsafeGlobal.company.update({
      where: { id },
      data: {
        status: status as any,
        verifiedAt: status === CompanyStatus.VERIFIED ? new Date() : undefined,
      },
    });

    // Invalidate Redis cache immediately
    await this.tenantService.invalidateCompany(id);

    return updated;
  }
}
