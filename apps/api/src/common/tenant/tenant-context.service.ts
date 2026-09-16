import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  userId?: string;
  companyId?: string;
  role?: string;
  companyStatus?: string;
  userStatus?: string;
  isGlobal?: boolean;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<R>(context: TenantContext, callback: () => R): R {
    return this.storage.run(context, callback);
  }

  get(): TenantContext | undefined {
    return this.storage.getStore();
  }

  getCompanyId(): string | undefined {
    return this.storage.getStore()?.companyId;
  }

  getUserId(): string | undefined {
    return this.storage.getStore()?.userId;
  }

  getRole(): string | undefined {
    return this.storage.getStore()?.role;
  }

  isPlatformAdmin(): boolean {
    const ctx = this.storage.getStore();
    return ctx?.role === 'PLATFORM_ADMIN';
  }

  isGlobal(): boolean {
    const ctx = this.storage.getStore();
    return Boolean(ctx?.isGlobal || ctx?.role === 'PLATFORM_ADMIN');
  }
}
