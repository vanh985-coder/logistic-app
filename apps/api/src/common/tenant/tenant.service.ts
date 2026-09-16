import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../modules/redis/redis.service';
import { PrismaService } from '../../modules/prisma/prisma.service';

export interface CachedTenantContext {
  userId: string;
  companyId: string;
  role: string;
  userStatus: string;
  companyStatus: string;
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private readonly CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private getKey(userId: string): string {
    return `user:tenant:${userId}`;
  }

  /**
   * Resolves tenant context for a given userId.
   * Leverages Redis cache to avoid hitting PostgreSQL on every request.
   */
  async resolveTenantContext(userId: string): Promise<CachedTenantContext | null> {
    const redis = this.redis.getClient();
    const key = this.getKey(userId);

    // 1. Try Redis cache
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as CachedTenantContext;
      }
    } catch (err) {
      this.logger.warn(`Failed reading tenant context cache for user ${userId}: ${(err as Error).message}`);
    }

    // 2. Cache miss: Fetch from PostgreSQL using unsafeGlobal
    const user = await this.prisma.unsafeGlobal.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user || user.deletedAt) {
      return null;
    }

    const context: CachedTenantContext = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      userStatus: user.status,
      companyStatus: user.company.status,
    };

    // 3. Write back to Redis
    try {
      await redis.set(key, JSON.stringify(context), 'EX', this.CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`Failed saving tenant context cache for user ${userId}: ${(err as Error).message}`);
    }

    return context;
  }

  /**
   * Immediately invalidates tenant cache for a specific user.
   */
  async invalidateUser(userId: string): Promise<void> {
    try {
      await this.redis.getClient().del(this.getKey(userId));
    } catch (err) {
      this.logger.error(`Error invalidating cache for user ${userId}`, err);
    }
  }

  /**
   * Immediately invalidates tenant cache for all users of a company (e.g. on company suspension).
   */
  async invalidateCompany(companyId: string): Promise<void> {
    try {
      const users = await this.prisma.unsafeGlobal.user.findMany({
        where: { companyId },
        select: { id: true },
      });

      if (users.length > 0) {
        const keys = users.map((u) => this.getKey(u.id));
        await this.redis.getClient().del(...keys);
      }
    } catch (err) {
      this.logger.error(`Error invalidating cache for company ${companyId}`, err);
    }
  }
}
