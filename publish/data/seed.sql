-- Seed mau cho moi truong moi (chay sau schema + migrations).
-- Seed nay duoc viet theo dung schema Prisma hien tai.

BEGIN;

INSERT INTO "branches" (
  "id", "code", "name", "phone", "email", "address", "openingTime", "closingTime",
  "maxDepositHours", "maxBookingsPerDay", "requiresDeposit", "createdAt", "updatedAt"
) VALUES (
  'branch_deploy_workspace',
  'BKK-DEPLOY',
  'FitFlow Deploy Workspace',
  '0280009000',
  'deploy@fitflow.local',
  'Deploy zone',
  '05:30',
  '22:00',
  24,
  120,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "users" (
  "id", "username", "employeeCode", "attendanceCode", "fullName", "email", "phone",
  "passwordHash", "status", "createdAt", "updatedAt", "branchId"
) VALUES (
  'user_deploy_admin',
  'deploy_admin',
  'EMP-DEPLOY',
  'AT-DEPLOY',
  'Deploy Admin',
  'deploy_admin@fitflow.local',
  '0919009000',
  crypt('Admin@123', gen_salt('bf')),
  'ACTIVE',
  NOW(),
  NOW(),
  'branch_deploy_workspace'
)
ON CONFLICT ("username") DO NOTHING;

INSERT INTO "roles" ("id", "code", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES (
  'role_deploy_admin',
  'deploy_admin',
  'Deploy Admin',
  'Role mau danh cho moi truong deploy moi.',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" ("id", "code", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES (
  'role_super_admin',
  'super_admin',
  'Super Admin',
  'Role full access cho moi truong deploy moi.',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO NOTHING;

WITH modules AS (
  SELECT unnest(ARRAY[
    'dashboard',
    'customers',
    'customer-groups',
    'customer-sources',
    'leads',
    'contracts',
    'services',
    'service-packages',
    'trainers',
    'training-sessions',
    'receipts',
    'expenses',
    'lockers',
    'deposits',
    'products',
    'suppliers',
    'purchase-orders',
    'branches',
    'users',
    'roles',
    'permissions',
    'settings',
    'audit-logs',
    'reports',
    'attendance-machines',
    'staff-attendance-events',
    'attachments',
    'tenant-databases'
  ]) AS module_name
),
actions AS (
  SELECT unnest(ARRAY[
    'view',
    'create',
    'update',
    'delete',
    'restore',
    'approve',
    'export',
    'report',
    'branch_scope',
    'own_scope'
  ]) AS action_name
)
INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "updatedAt")
SELECT
  'perm_' || replace(module_name, '-', '_') || '_' || action_name,
  module_name || '.' || action_name,
  module_name,
  action_name,
  'Auto-seeded permission for ' || module_name || ' ' || action_name,
  NOW(),
  NOW()
FROM modules
CROSS JOIN actions
ON CONFLICT ("code") DO NOTHING;

WITH report_keys AS (
  SELECT unnest(ARRAY[
    'kpi',
    'lead',
    'branch-revenue',
    'contract-remain',
    'payment',
    'deposit',
    'trainer-performance',
    'birthday',
    'follow-up',
    'checkin',
    'pt-training',
    'staff-attendance',
    'class-attendance',
    'allocation',
    'sales-summary',
    'debt',
    'branch-summary',
    'package-progress',
    'card-revenue',
    'staff-review',
    'lead-status'
  ]) AS report_key
)
INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "updatedAt")
SELECT
  'perm_reports_' || replace(report_key, '-', '_') || '_view',
  'reports-' || report_key || '.view',
  'reports-' || report_key,
  'view',
  'Auto-seeded detailed report permission for ' || report_key,
  NOW(),
  NOW()
FROM report_keys
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "user_roles" ("userId", "roleId")
VALUES ('user_deploy_admin', 'role_deploy_admin')
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "user_roles" ("userId", "roleId")
SELECT 'user_deploy_admin', "id"
FROM "roles"
WHERE "code" = 'super_admin'
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT roles."id", permissions."id"
FROM "roles"
CROSS JOIN "permissions"
WHERE roles."code" = 'super_admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
