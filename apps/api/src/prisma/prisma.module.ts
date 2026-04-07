import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantCatalogService } from './tenant-catalog.service';
import { TenantClientManager } from './tenant-client-manager.service';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantClientManager,
    TenantCatalogService,
    TenantContextMiddleware,
    PrismaService,
  ],
  exports: [
    TenantContextService,
    TenantClientManager,
    TenantCatalogService,
    TenantContextMiddleware,
    PrismaService,
  ],
})
export class PrismaModule {}
