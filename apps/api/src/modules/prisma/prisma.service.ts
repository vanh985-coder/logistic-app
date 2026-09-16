import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TenantContextMissingException } from '../../common/tenant/tenant-context-missing.exception';
import {
  TENANT_MODELS,
  TENANT_SELF_MODELS,
  GLOBAL_MODELS,
  validateAllModelsClassified,
} from '../../common/tenant/tenant-models.config';

function toModelKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly basePrisma: PrismaClient;
  private readonly extendedClient: any;

  constructor(private readonly tenantContextService: TenantContextService) {
    this.basePrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    const tenantContext = this.tenantContextService;
    const base = this.basePrisma;

    this.extendedClient = this.basePrisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const context = tenantContext.get();

            // 1. Explicit bypass for Platform Admin or background/unsafeGlobal
            if (context?.isGlobal || context?.role === 'PLATFORM_ADMIN') {
              return query(args);
            }

            // 2. Explicit bypass for purely GLOBAL_MODELS
            if ((GLOBAL_MODELS as readonly string[]).includes(model)) {
              return query(args);
            }

            // 3. Check for Zero-Context Access on Tenant Scoped Models
            if (
              (TENANT_MODELS as readonly string[]).includes(model) ||
              (TENANT_SELF_MODELS as readonly string[]).includes(model)
            ) {
              if (!context?.companyId) {
                throw new TenantContextMissingException(model);
              }
            }

            const companyId = context!.companyId!;
            const modelKey = toModelKey(model);

            // 4. Handle TENANT_MODELS (e.g. User, RefreshToken, Orders)
            if ((TENANT_MODELS as readonly string[]).includes(model)) {
              if (operation === 'findUnique') {
                return (base as any)[modelKey].findFirst({
                  ...args,
                  where: {
                    ...args.where,
                    companyId,
                  },
                });
              }

              if (operation === 'findUniqueOrThrow') {
                return (base as any)[modelKey].findFirstOrThrow({
                  ...args,
                  where: {
                    ...args.where,
                    companyId,
                  },
                });
              }

              if (
                [
                  'findFirst',
                  'findFirstOrThrow',
                  'findMany',
                  'count',
                  'aggregate',
                  'groupBy',
                ].includes(operation)
              ) {
                args.where = { ...args.where, companyId };
                return query(args);
              }

              if (operation === 'create') {
                args.data = { ...args.data, companyId };
                return query(args);
              }

              if (operation === 'createMany') {
                if (Array.isArray(args.data)) {
                  args.data = args.data.map((item: any) => ({
                    ...item,
                    companyId,
                  }));
                }
                return query(args);
              }

              if (['update', 'delete'].includes(operation)) {
                // Ensure target record belongs to caller's company before modifying
                await (base as any)[modelKey].findFirstOrThrow({
                  where: {
                    ...args.where,
                    companyId,
                  },
                  select: { id: true },
                });
                return query(args);
              }

              if (['updateMany', 'deleteMany'].includes(operation)) {
                args.where = { ...args.where, companyId };
                return query(args);
              }

              if (operation === 'upsert') {
                // For upsert, ensure companyId in create & where check
                args.create = { ...args.create, companyId };
                await (base as any)[modelKey].findFirstOrThrow({
                  where: {
                    ...args.where,
                    companyId,
                  },
                  select: { id: true },
                });
                return query(args);
              }
            }

            // 5. Handle TENANT_SELF_MODELS (e.g. Company, where filter is id: companyId)
            if ((TENANT_SELF_MODELS as readonly string[]).includes(model)) {
              if (operation === 'findUnique') {
                return (base as any)[modelKey].findFirst({
                  ...args,
                  where: {
                    ...args.where,
                    id: companyId,
                  },
                });
              }

              if (operation === 'findUniqueOrThrow') {
                return (base as any)[modelKey].findFirstOrThrow({
                  ...args,
                  where: {
                    ...args.where,
                    id: companyId,
                  },
                });
              }

              if (
                [
                  'findFirst',
                  'findFirstOrThrow',
                  'findMany',
                  'count',
                  'aggregate',
                  'groupBy',
                ].includes(operation)
              ) {
                args.where = { ...args.where, id: companyId };
                return query(args);
              }

              if (['update', 'delete'].includes(operation)) {
                await (base as any)[modelKey].findFirstOrThrow({
                  where: {
                    ...args.where,
                    id: companyId,
                  },
                  select: { id: true },
                });
                return query(args);
              }

              if (['updateMany', 'deleteMany'].includes(operation)) {
                args.where = { ...args.where, id: companyId };
                return query(args);
              }
            }

            return query(args);
          },
        },
      },
    });

    // Return Proxy so callers can invoke this.prisma.user, this.prisma.$transaction, etc.
    return new Proxy(this, {
      get: (target: any, prop: string | symbol) => {
        if (prop in target) {
          return target[prop];
        }
        return target.extendedClient[prop];
      },
    });
  }

  /**
   * Escape hatch for unauthenticated auth operations (AuthService.login, AuthService.register,
   * TokenService.rotateRefreshToken) and Worker jobs with manual tenancy resolution.
   */
  get unsafeGlobal(): PrismaClient {
    return this.basePrisma;
  }

  async onModuleInit() {
    try {
      // 1. Fail-fast bootstrap classification check
      const modelNames = Prisma.dmmf.datamodel.models.map((m) => m.name);
      validateAllModelsClassified(modelNames);
      this.logger.log(
        `Multi-Tenant model classification validated successfully (${modelNames.length} models)`,
      );

      // 2. Connect to database
      await this.basePrisma.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PrismaService', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.basePrisma.$disconnect();
    this.logger.log('Database disconnected');
  }

  async isHealthy(): Promise<boolean> {
    try {
      await Promise.race([
        this.basePrisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 1000),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
