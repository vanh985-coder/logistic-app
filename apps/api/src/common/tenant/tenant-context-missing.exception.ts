import { ForbiddenException } from '@nestjs/common';

export class TenantContextMissingException extends ForbiddenException {
  constructor(modelName: string) {
    super(
      `[Multi-Tenant Security] Tenant context is missing for tenant-scoped model '${modelName}'. Direct unauthenticated queries to tenant-scoped models are prohibited.`,
    );
  }
}
