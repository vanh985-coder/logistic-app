export const TENANT_MODELS = ['User', 'RefreshToken', 'Shipment', 'Package'] as const;
export const TENANT_SELF_MODELS = ['Company'] as const;
export const GLOBAL_MODELS = ['Lane', 'PricingConfig'] as const;

export type TenantModel = (typeof TENANT_MODELS)[number];
export type TenantSelfModel = (typeof TENANT_SELF_MODELS)[number];
export type GlobalModel = (typeof GLOBAL_MODELS)[number];

export function validateAllModelsClassified(
  allDmmfModelNames: string[],
  tenantModels: readonly string[] = TENANT_MODELS,
  tenantSelfModels: readonly string[] = TENANT_SELF_MODELS,
  globalModels: readonly string[] = GLOBAL_MODELS,
): void {
  const classified = new Set<string>([
    ...tenantModels,
    ...tenantSelfModels,
    ...globalModels,
  ]);

  const unclassified = allDmmfModelNames.filter((m) => !classified.has(m));

  if (unclassified.length > 0) {
    throw new Error(
      `[Multi-Tenant Security Bootstrap Error] The following Prisma models are not classified for multi-tenancy: ${unclassified.join(', ')}. ` +
        `Every model must be explicitly declared in TENANT_MODELS, TENANT_SELF_MODELS, or GLOBAL_MODELS in tenant-models.config.ts ` +
        `to ensure tenant isolation is never bypassed accidentally.`,
    );
  }
}
