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

INSERT INTO "user_roles" ("userId", "roleId")
VALUES ('user_deploy_admin', 'role_deploy_admin')
ON CONFLICT ("userId", "roleId") DO NOTHING;

COMMIT;
