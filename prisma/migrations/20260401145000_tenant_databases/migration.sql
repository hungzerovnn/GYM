CREATE TABLE IF NOT EXISTS "tenant_databases" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "databaseHost" TEXT NOT NULL,
  "databasePort" INTEGER NOT NULL DEFAULT 5432,
  "databaseName" TEXT NOT NULL,
  "databaseUser" TEXT NOT NULL,
  "connectionUrl" TEXT NOT NULL,
  "adminUsername" TEXT,
  "adminEmail" TEXT,
  "branchName" TEXT,
  "appUrl" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,

  CONSTRAINT "tenant_databases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_databases_code_key" ON "tenant_databases"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_databases_databaseName_key" ON "tenant_databases"("databaseName");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_databases_connectionUrl_key" ON "tenant_databases"("connectionUrl");
CREATE INDEX IF NOT EXISTS "tenant_databases_isActive_isSystem_idx" ON "tenant_databases"("isActive", "isSystem");
