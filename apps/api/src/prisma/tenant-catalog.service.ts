import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, TenantDatabase } from '@prisma/client';

export interface TenantConnectionPayload {
  host: string;
  port: number;
  databaseName: string;
  user: string;
  password: string;
  schema?: string;
}

@Injectable()
export class TenantCatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly masterClient = new PrismaClient();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.masterClient.$connect();
    await this.ensureMasterTenantRegistered();
  }

  async onModuleDestroy() {
    await this.masterClient.$disconnect();
  }

  get master() {
    return this.masterClient;
  }

  getMasterConnectionUrl() {
    return this.configService.get<string>('DATABASE_URL', '');
  }

  getDefaultTenantAppUrl() {
    return this.configService.get<string>(
      'TENANT_APP_URL_DEFAULT',
      'http://localhost:6273',
    );
  }

  parseConnectionUrl(connectionUrl: string) {
    const url = new URL(connectionUrl);
    return {
      host: url.hostname,
      port: Number(url.port || '5432'),
      databaseName: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      schema: url.searchParams.get('schema') || 'public',
    };
  }

  buildConnectionUrl(payload: TenantConnectionPayload) {
    const url = new URL('postgresql://placeholder');
    url.username = payload.user;
    url.password = payload.password;
    url.hostname = payload.host;
    url.port = String(payload.port || 5432);
    url.pathname = `/${payload.databaseName}`;
    url.searchParams.set('schema', payload.schema || 'public');
    return url.toString().replace('placeholder', '');
  }

  async ensureMasterTenantRegistered() {
    const masterUrl = this.getMasterConnectionUrl();
    const parsed = this.parseConnectionUrl(masterUrl);

    return this.masterClient.tenantDatabase.upsert({
      where: { code: 'MASTER' },
      update: {
        name: 'Master system',
        databaseHost: parsed.host,
        databasePort: parsed.port,
        databaseName: parsed.databaseName,
        databaseUser: parsed.user,
        connectionUrl: masterUrl,
        appUrl: this.getDefaultTenantAppUrl(),
        isActive: true,
        isSystem: true,
      },
      create: {
        code: 'MASTER',
        name: 'Master system',
        databaseHost: parsed.host,
        databasePort: parsed.port,
        databaseName: parsed.databaseName,
        databaseUser: parsed.user,
        connectionUrl: masterUrl,
        appUrl: this.getDefaultTenantAppUrl(),
        isActive: true,
        isSystem: true,
      },
    });
  }

  async findTenantOrThrow(code?: string) {
    const tenantCode = (code || 'MASTER').trim().toUpperCase();
    await this.ensureMasterTenantRegistered();

    const tenant = await this.masterClient.tenantDatabase.findUnique({
      where: { code: tenantCode },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Khong tim thay co so du lieu da chon');
    }

    return tenant;
  }

  async listActiveTenants() {
    await this.ensureMasterTenantRegistered();

    return this.masterClient.tenantDatabase.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        code: true,
        name: true,
        databaseName: true,
        databaseHost: true,
        appUrl: true,
        isSystem: true,
      },
    });
  }
}
