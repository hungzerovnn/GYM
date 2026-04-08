export const modulePermissions = [
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
  'staff-shifts',
  'staff-shift-assignments',
  'staff-attendance-events',
  'member-presence',
  'attachments',
  'tenant-databases',
] as const;

export const permissionActions = [
  'view',
  'create',
  'update',
  'delete',
  'restore',
  'approve',
  'export',
  'report',
  'branch_scope',
  'own_scope',
] as const;

export const systemRoles = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Full access',
    isSystem: true,
  },
  {
    code: 'system_owner',
    name: 'Chu he thong',
    description: 'System owner',
    isSystem: true,
  },
  {
    code: 'branch_manager',
    name: 'Quan ly chi nhanh',
    description: 'Branch manager',
    isSystem: true,
  },
  {
    code: 'sales',
    name: 'Le tan / Sales',
    description: 'Sales and reception',
    isSystem: true,
  },
  {
    code: 'accountant',
    name: 'Ke toan',
    description: 'Finance operations',
    isSystem: true,
  },
  {
    code: 'trainer',
    name: 'PT / Huan luyen vien',
    description: 'Trainer',
    isSystem: true,
  },
  {
    code: 'customer_care',
    name: 'CSKH',
    description: 'Customer care',
    isSystem: true,
  },
  {
    code: 'hr',
    name: 'Nhan su',
    description: 'HR and attendance',
    isSystem: true,
  },
] as const;

const branchManagerModules = [
  'dashboard',
  'customers',
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
  'reports',
  'audit-logs',
  'attendance-machines',
  'staff-shifts',
  'staff-shift-assignments',
  'staff-attendance-events',
  'member-presence',
  'attachments',
] as const;

const salesModules = [
  'dashboard',
  'customers',
  'leads',
  'member-presence',
  'contracts',
  'receipts',
  'attachments',
  'reports',
] as const;
const salesLookupViewModules = [
  'branches',
  'users',
  'customer-groups',
  'customer-sources',
  'service-packages',
  'trainers',
] as const;
const accountantModules = [
  'dashboard',
  'receipts',
  'expenses',
  'reports',
  'contracts',
  'customers',
  'audit-logs',
] as const;
const accountantLookupViewModules = [
  'branches',
  'users',
  'customer-groups',
  'customer-sources',
  'service-packages',
  'trainers',
] as const;
const trainerModules = [
  'dashboard',
  'customers',
  'member-presence',
  'trainers',
  'training-sessions',
  'reports',
] as const;
const trainerLookupViewModules = [
  'branches',
  'contracts',
  'users',
  'customer-groups',
  'customer-sources',
] as const;
const customerCareModules = [
  'dashboard',
  'customers',
  'leads',
  'member-presence',
  'reports',
  'attachments',
] as const;
const customerCareLookupViewModules = [
  'branches',
  'users',
  'customer-groups',
  'customer-sources',
] as const;
const branchManagerLookupViewModules = [
  'branches',
  'users',
  'customer-groups',
  'customer-sources',
] as const;
const hrModules = [
  'dashboard',
  'users',
  'branches',
  'attendance-machines',
  'staff-shifts',
  'staff-shift-assignments',
  'staff-attendance-events',
  'member-presence',
  'settings',
  'reports',
] as const;
const hrLookupViewModules = ['roles'] as const;

const isLookupViewGrant = <TModules extends readonly string[]>(
  moduleName: string,
  action: string | undefined,
  lookupModules: TModules,
) =>
  action === 'view' && lookupModules.includes(moduleName as TModules[number]);

export const getGrantedPermissionCodes = (
  roleCode: string,
  permissionCodes: string[],
) => {
  if (roleCode === 'super_admin') {
    return permissionCodes;
  }

  if (roleCode === 'system_owner') {
    return permissionCodes.filter(
      (code) => !code.startsWith('permissions.delete'),
    );
  }

  if (roleCode === 'branch_manager') {
    return permissionCodes.filter((code) => {
      const [moduleName, action] = code.split('.');
      return (
        branchManagerModules.some((allowedModuleName) =>
          code.startsWith(`${allowedModuleName}.`),
        ) ||
        isLookupViewGrant(moduleName, action, branchManagerLookupViewModules)
      );
    });
  }

  if (roleCode === 'sales') {
    return permissionCodes.filter((code) => {
      const [moduleName, action] = code.split('.');
      return (
        (salesModules.includes(moduleName as (typeof salesModules)[number]) &&
          !['delete', 'approve'].includes(action)) ||
        isLookupViewGrant(moduleName, action, salesLookupViewModules)
      );
    });
  }

  if (roleCode === 'accountant') {
    return permissionCodes.filter((code) => {
      const [moduleName, action] = code.split('.');
      return (
        (accountantModules.includes(
          moduleName as (typeof accountantModules)[number],
        ) &&
          !['delete'].includes(action)) ||
        isLookupViewGrant(moduleName, action, accountantLookupViewModules)
      );
    });
  }

  if (roleCode === 'trainer') {
    return permissionCodes.filter((code) => {
      const [moduleName, action] = code.split('.');
      return (
        (trainerModules.includes(
          moduleName as (typeof trainerModules)[number],
        ) &&
          !['delete', 'approve'].includes(action)) ||
        isLookupViewGrant(moduleName, action, trainerLookupViewModules)
      );
    });
  }

  if (roleCode === 'customer_care') {
    return permissionCodes.filter((code) => {
      const [moduleName, action] = code.split('.');
      return (
        (customerCareModules.includes(
          moduleName as (typeof customerCareModules)[number],
        ) &&
          !['delete', 'approve'].includes(action)) ||
        isLookupViewGrant(moduleName, action, customerCareLookupViewModules)
      );
    });
  }

  if (roleCode === 'hr') {
    return permissionCodes.filter((code) => {
      const [moduleName, action] = code.split('.');
      return (
        (hrModules.includes(moduleName as (typeof hrModules)[number]) &&
          !['delete'].includes(action)) ||
        isLookupViewGrant(moduleName, action, hrLookupViewModules)
      );
    });
  }

  return [];
};

export const defaultPaymentMethods = [
  { code: 'CASH', name: 'Tien mat', type: 'cash' },
  { code: 'BANK', name: 'Chuyen khoan', type: 'bank' },
  { code: 'CARD', name: 'The POS', type: 'card' },
  { code: 'EWALLET', name: 'Vi dien tu', type: 'wallet' },
] as const;

export const defaultCustomerGroups = [
  {
    code: 'VIP',
    name: 'VIP',
    description: 'Khach hang gia tri cao',
    color: '#16a34a',
  },
  {
    code: 'REGULAR',
    name: 'Regular',
    description: 'Hoi vien thong thuong',
    color: '#0f766e',
  },
] as const;

export const defaultCustomerSources = [
  {
    code: 'WALKIN',
    name: 'Walk-in',
    channel: 'Offline',
    description: 'Khach den truc tiep',
  },
  {
    code: 'FACEBOOK',
    name: 'Facebook',
    channel: 'Social',
    description: 'Kenh social lead',
  },
] as const;

export const defaultLeadSources = [
  { code: 'ADS', name: 'Facebook Ads', channel: 'Social' },
  { code: 'REF', name: 'Referral', channel: 'Referral' },
  { code: 'WEB', name: 'Website', channel: 'Online' },
] as const;

export const defaultSystemProfile = {
  appName: 'FitFlow Enterprise',
  timezone: 'Asia/Bangkok',
  currency: 'VND',
  dateFormat: 'DD/MM/YYYY',
  codeGeneration: true,
  uploadLimitMb: 10,
  memberPresenceOvernightGraceHours: 6,
};

export const defaultOtpSetting = {
  enabled: false,
  channel: 'ZALO',
  apiUrl: 'https://business.openapi.zalo.me/message/template',
  otpTemplateId: '',
  otpTemplateDataKey: 'otp',
  otpPhoneOverride: '',
  codeLength: 6,
  ttlMinutes: 5,
  resendCooldownSeconds: 60,
  maxRetry: 5,
};
