import { Injectable } from '@nestjs/common';
import { PrismaClient, TenantDatabase } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantRequestContext {
  tenantCode: string;
  tenantName: string;
  tenantRecord: TenantDatabase | null;
  client: PrismaClient;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantRequestContext>();

  run<T>(context: TenantRequestContext, callback: () => T) {
    return this.storage.run(context, callback);
  }

  getStore() {
    return this.storage.getStore();
  }

  getClient() {
    return this.storage.getStore()?.client;
  }

  getTenantCode() {
    return this.storage.getStore()?.tenantCode || 'MASTER';
  }

  getTenantName() {
    return this.storage.getStore()?.tenantName || 'Master';
  }

  getTenantRecord() {
    return this.storage.getStore()?.tenantRecord || null;
  }
}
