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

export type FieldType =
  | "text"
  | "textarea"
  | "line-items"
  | "purchase-order-items"
  | "checklist"
  | "permission-matrix"
  | "date"
  | "datetime"
  | "select"
  | "number"
  | "currency"
  | "email"
  | "phone"
  | "password";

export interface ResourceField {
  name: string;
  label: string;
  type: FieldType;
  virtual?: boolean;
  hidden?: boolean;
  advanced?: boolean;
  readOnly?: boolean;
  autoManaged?: boolean;
  required?: boolean;
  placeholder?: string;
  span?: 1 | 2 | 3;
  section?: string;
  description?: string;
  sensitive?: boolean;
  multiple?: boolean;
  createOnly?: boolean;
  editOnly?: boolean;
  options?: { label: string; value: string }[];
  optionsEndpoint?: string;
  optionLabelKey?: string;
  optionValueKey?: string;
}

export interface ResourceColumn {
  key: string;
  label: string;
  type?: "text" | "date" | "currency" | "status";
  minWidth?: number;
  wrap?: boolean;
  multiline?: boolean;
  align?: "left" | "center" | "right";
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
}

export interface ResourceFilter {
  name: string;
  label: string;
  type: "select" | "date";
  options?: { label: string; value: string }[];
  optionsEndpoint?: string;
  optionLabelKey?: string;
  optionValueKey?: string;
}

export interface ResourceDefinition {
  key: string;
  baseKey?: string;
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  createLabel?: string;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateExamples?: string[];
  defaultFilters?: Record<string, string>;
  endpoint: string;
  permissionPrefix: string;
  columns: ResourceColumn[];
  filters: ResourceFilter[];
  fields: ResourceField[];
  detailFields: string[];
}

export interface ReportDefinition {
  key: string;
  baseKey?: string;
  title: string;
  subtitle: string;
  endpoint: string;
  permission?: string;
  summaryKeys: { key: string; label: string }[];
}

export interface SettingDefinition {
  key: string;
  baseKey?: string;
  title: string;
  subtitle: string;
  ownerOnly?: boolean;
  searchPlaceholder?: string;
  createLabel?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  noticeTitle?: string;
  noticeDescription?: string;
  endpoint: string;
  fields: ResourceField[];
  layout?:
    | "form"
    | "template"
    | "communication"
    | "report-template-manager"
    | "social-hub"
    | "social-link-center";
  summaryItems?: Array<{
    label: string;
    key: string;
    type?: "text" | "status" | "currency" | "date" | "datetime";
  }>;
}

export interface MenuItem {
  label: string;
  href: string;
  icon?: string;
  description?: string;
  ownerOnly?: boolean;
}

export interface MenuGroup {
  title: string;
  href?: string;
  icon?: string;
  items: MenuItem[];
}

export interface PortalPageDefinition {
  kind: "dashboard" | "resource" | "report" | "setting";
  key: string;
  title?: string;
  subtitle?: string;
  resourceKey?: string;
  reportKey?: string;
  settingKey?: string;
}
