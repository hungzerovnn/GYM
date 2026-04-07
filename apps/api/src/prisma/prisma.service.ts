import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly localProperties = new Set([
    'localProperties',
    'tenantContextService',
    'master',
    'getTenantCode',
    'getTenantName',
    'getCurrentClient',
    'onModuleInit',
    'onModuleDestroy',
    'enableShutdownHooks',
  ]);

  constructor(private readonly tenantContextService: TenantContextService) {
    super();

    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (property === 'master') {
          return target;
        }

        if (target.localProperties.has(String(property))) {
          return Reflect.get(target, property, receiver);
        }

        const client = target.getCurrentClient();
        const value = Reflect.get(client as object, property, client);
        return typeof value === 'function' ? value.bind(client) : value;
      },
    }) as PrismaService;
  }

  get master() {
    return this;
  }

  getTenantCode() {
    return this.tenantContextService.getTenantCode();
  }

  getTenantName() {
    return this.tenantContextService.getTenantName();
  }

  private getCurrentClient() {
    return this.tenantContextService.getClient() || this;
  }

  async onModuleInit() {
    await super.$connect();
  }

  async onModuleDestroy() {
    await super.$disconnect();
  }

  async enableShutdownHooks(_app: INestApplication) {
    return Promise.resolve();
  }
}
