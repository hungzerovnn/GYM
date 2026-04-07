import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { TenantClientManager } from './tenant-client-manager.service';
import { TenantCatalogService } from './tenant-catalog.service';
import { TenantContextService } from './tenant-context.service';

const decodeJwtPayload = (token: string) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(
      Buffer.from(normalized, 'base64').toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
};

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantCatalogService: TenantCatalogService,
    private readonly tenantClientManager: TenantClientManager,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async use(req: Request, _res: Response, next: () => void) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const jwtPayload = bearerToken ? decodeJwtPayload(bearerToken) : null;
    const headerTenant = req.headers['x-tenant-key']?.toString();
    const tokenTenant =
      typeof jwtPayload?.tenantCode === 'string'
        ? jwtPayload.tenantCode
        : undefined;
    const tenantKey = (tokenTenant || headerTenant || 'MASTER')
      .trim()
      .toUpperCase();
    const tenant = await this.tenantCatalogService.findTenantOrThrow(tenantKey);
    const client = await this.tenantClientManager.getClient(
      tenant.connectionUrl,
    );

    req.headers['x-tenant-key'] = tenant.code;

    this.tenantContextService.run(
      {
        tenantCode: tenant.code,
        tenantName: tenant.name,
        tenantRecord: tenant,
        client,
      },
      () => next(),
    );
  }
}
