export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  tenantCode: string;
  tenantName?: string;
  branchId?: string | null;
  branchName?: string | null;
  roleCodes: string[];
  roleNames?: string[];
  permissions: string[];
}
