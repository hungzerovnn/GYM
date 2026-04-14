import { ResourceDefinition } from "@/types/portal";

export type PrintableResourceProfile = "receipt" | "expense" | "sale" | "return";
export type PrintableValueType = "text" | "currency" | "date" | "datetime" | "status";

export const resourceDetailConfigs: Record<
  string,
  {
    detailEndpoint: (id: string) => string;
    timelineEndpoint?: (id: string) => string;
    entityType: string;
  }
> = {
  customers: {
    detailEndpoint: (id) => `/customers/${id}`,
    timelineEndpoint: (id) => `/customers/${id}/timeline`,
    entityType: "customer",
  },
  "customer-groups": {
    detailEndpoint: (id) => `/customer-groups/${id}`,
    entityType: "customer_group",
  },
  "customer-sources": {
    detailEndpoint: (id) => `/customer-sources/${id}`,
    entityType: "customer_source",
  },
  "product-groups": {
    detailEndpoint: (id) => `/product-groups/${id}`,
    entityType: "product_group",
  },
  leads: {
    detailEndpoint: (id) => `/leads/${id}`,
    entityType: "lead",
  },
  contracts: {
    detailEndpoint: (id) => `/contracts/${id}`,
    entityType: "contract",
  },
  services: {
    detailEndpoint: (id) => `/services/${id}`,
    entityType: "service",
  },
  "service-packages": {
    detailEndpoint: (id) => `/service-packages/${id}`,
    entityType: "service_package",
  },
  trainers: {
    detailEndpoint: (id) => `/trainers/${id}`,
    entityType: "trainer",
  },
  "training-sessions": {
    detailEndpoint: (id) => `/training-sessions/${id}`,
    entityType: "training_session",
  },
  lockers: {
    detailEndpoint: (id) => `/lockers/${id}`,
    entityType: "locker",
  },
  "locker-rentals": {
    detailEndpoint: (id) => `/locker-rentals/${id}`,
    entityType: "locker_rental",
  },
  "towel-issues": {
    detailEndpoint: (id) => `/towel-issues/${id}`,
    entityType: "towel_issue",
  },
  deposits: {
    detailEndpoint: (id) => `/deposits/${id}`,
    entityType: "deposit",
  },
  branches: {
    detailEndpoint: (id) => `/branches/${id}`,
    entityType: "branch",
  },
  users: {
    detailEndpoint: (id) => `/users/${id}`,
    entityType: "user",
  },
  roles: {
    detailEndpoint: (id) => `/roles/${id}`,
    entityType: "role",
  },
  "tenant-databases": {
    detailEndpoint: (id) => `/tenant-databases/${id}`,
    entityType: "tenant_database",
  },
  "attendance-machines": {
    detailEndpoint: (id) => `/attendance-machines/${id}`,
    entityType: "attendance_machine",
  },
  "staff-shifts": {
    detailEndpoint: (id) => `/staff-shifts/${id}`,
    entityType: "staff_shift",
  },
  "staff-shift-assignments": {
    detailEndpoint: (id) => `/staff-shift-assignments/${id}`,
    entityType: "staff_shift_assignment",
  },
  products: {
    detailEndpoint: (id) => `/products/${id}`,
    entityType: "product",
  },
  suppliers: {
    detailEndpoint: (id) => `/suppliers/${id}`,
    entityType: "supplier",
  },
  "purchase-orders": {
    detailEndpoint: (id) => `/purchase-orders/${id}`,
    entityType: "purchase_order",
  },
  receipts: {
    detailEndpoint: (id) => `/receipts/${id}`,
    entityType: "receipt",
  },
  "shop-sales": {
    detailEndpoint: (id) => `/shop-sales/${id}`,
    entityType: "receipt",
  },
  expenses: {
    detailEndpoint: (id) => `/expenses/${id}`,
    entityType: "expense",
  },
  "shop-returns": {
    detailEndpoint: (id) => `/shop-returns/${id}`,
    entityType: "expense",
  },
  "audit-logs": {
    detailEndpoint: (id) => `/audit-logs/${id}`,
    entityType: "audit_log",
  },
  "staff-attendance-events": {
    detailEndpoint: (id) => `/staff-attendance-events/${id}`,
    entityType: "staff_attendance_event",
  },
  "member-presence": {
    detailEndpoint: (id) => `/member-presence/${id}`,
    entityType: "member_presence_session",
  },
};

export const toReadableLabel = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

export const resolveResourcePrintProfile = (resource: Pick<ResourceDefinition, "key" | "baseKey" | "title">) => {
  const tokens = `${resource.key} ${resource.baseKey || ""} ${resource.title}`.toLowerCase();

  if (tokens.includes("pro-shop-sales") || tokens.includes("ban hang")) return "sale" as const;
  if (tokens.includes("pro-shop-returns") || tokens.includes("tra hang")) return "return" as const;
  if (tokens.includes("expenses") || tokens.includes("phieu chi")) return "expense" as const;
  if (tokens.includes("receipts") || tokens.includes("phieu thu")) return "receipt" as const;

  return null;
};

export const getResourceDetailConfig = (resource: Pick<ResourceDefinition, "key" | "baseKey">) =>
  resourceDetailConfigs[resource.baseKey || resource.key];

const extractDisplayValue = (value: unknown): unknown => {
  if (value === null || value === undefined || value === "") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => extractDisplayValue(item))
      .filter((item) => item !== null && item !== undefined && item !== "")
      .join(", ");
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    return source.fullName || source.name || source.label || source.title || source.code || source.id || "";
  }

  return value;
};

const mapFieldType = (type?: string): PrintableValueType | undefined => {
  if (type === "currency") return "currency";
  if (type === "date") return "date";
  if (type === "datetime") return "datetime";
  if (type === "status") return "status";
  return undefined;
};

export const buildResourcePrintEntries = (resource: ResourceDefinition, record: Record<string, unknown>) => {
  const labels = new Map<string, { label: string; type?: PrintableValueType }>();

  resource.columns.forEach((column) => labels.set(column.key, { label: column.label, type: mapFieldType(column.type) }));
  resource.fields.forEach((field) => {
    if (!labels.has(field.name)) {
      labels.set(field.name, { label: field.label, type: mapFieldType(field.type) });
    }
  });

  const orderedKeys = resource.detailFields.length
    ? resource.detailFields
    : Array.from(
        new Set(
          [...resource.columns.map((column) => column.key), ...resource.fields.map((field) => field.name)].filter(
            (key) => !/(^id$|Id$|Ids$|Avatar|Image|Secret|Token|Password|Url$)/.test(key),
          ),
        ),
      );

  return orderedKeys
    .map((key) => ({
      label: labels.get(key)?.label || toReadableLabel(key),
      value: extractDisplayValue(record[key]),
      type: labels.get(key)?.type,
    }))
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
};

const previewDateValues = ["2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22"];
const previewDateTimeValues = [
  "2026-04-01T08:30:00.000Z",
  "2026-04-08T10:15:00.000Z",
  "2026-04-15T14:00:00.000Z",
  "2026-04-22T17:45:00.000Z",
];

const buildPreviewCodePrefix = (resource: ResourceDefinition) => {
  const tokens = `${resource.key} ${resource.baseKey || ""} ${resource.title}`.toLowerCase();
  if (tokens.includes("customer") || tokens.includes("member")) return "HV";
  if (tokens.includes("lead")) return "LEAD";
  if (tokens.includes("contract")) return "HD";
  if (tokens.includes("receipt")) return "PT";
  if (tokens.includes("expense")) return "PC";
  if (tokens.includes("deposit")) return "COC";
  if (tokens.includes("product")) return "SP";
  if (tokens.includes("purchase")) return "PN";
  if (tokens.includes("supplier")) return "NCC";
  if (tokens.includes("locker")) return "TUDO";
  if (tokens.includes("branch")) return "CN";
  if (tokens.includes("user") || tokens.includes("staff")) return "NV";
  return "MAU";
};

const inferPreviewValue = (
  resource: ResourceDefinition,
  fieldKey: string,
  fieldType: string | undefined,
  index: number,
) => {
  const normalizedKey = fieldKey.toLowerCase();
  const sequence = index + 1;
  const codePrefix = buildPreviewCodePrefix(resource);

  if (
    fieldType === "currency" ||
    /(amount|price|revenue|debt|value|profit|vat|budget|ticket|balance|cost|fee|salary|commission)/.test(normalizedKey)
  ) {
    return sequence * 1250000;
  }

  if (fieldType === "date" || /(date|birthday|birth|issued|expires|expiry)/.test(normalizedKey)) {
    return previewDateValues[index % previewDateValues.length];
  }

  if (fieldType === "datetime" || /(createdat|updatedat|checkedin|checkedout|scheduled|time|at$)/.test(normalizedKey)) {
    return previewDateTimeValues[index % previewDateTimeValues.length];
  }

  if (fieldType === "status" || normalizedKey.includes("status")) {
    if (normalizedKey.includes("payment")) return "COMPLETED";
    if (normalizedKey.includes("presence")) return "ACTIVE";
    if (normalizedKey.includes("attendance")) return "PRESENT";
    return "ACTIVE";
  }

  if (/(phone|mobile|hotline|tel)/.test(normalizedKey)) {
    return `09123${String(4500 + sequence).padStart(4, "0")}`;
  }

  if (normalizedKey.includes("email")) {
    return "demo@fitflow.vn";
  }

  if (/(code|number|card|receipt|contract|reference|attendance)/.test(normalizedKey)) {
    return `${codePrefix}-${String(sequence).padStart(4, "0")}`;
  }

  if (normalizedKey.includes("branch")) {
    return "Chi nhanh Trung tam";
  }

  if (/(customer|member|fullname|contactname|ownername|partnername)/.test(normalizedKey)) {
    return "Nguyen Thi Anh";
  }

  if (normalizedKey.includes("lead")) {
    return "Le Minh Lead";
  }

  if (normalizedKey.includes("trainer")) {
    return "Tran Huu PT";
  }

  if (/(staff|user|collector|approver|assigned|sale|creator|cashier)/.test(normalizedKey)) {
    return "Le Hoang Sales";
  }

  if (normalizedKey.includes("group")) {
    return "Nhom VIP";
  }

  if (normalizedKey.includes("source")) {
    return "Referral";
  }

  if (/(service|package|product|item|plan)/.test(normalizedKey)) {
    return "Goi VIP 12 thang";
  }

  if (/(address|location|ward|district|city)/.test(normalizedKey)) {
    return "12 Nguyen Hue, Quan 1";
  }

  if (normalizedKey.includes("website")) {
    return "fitflow.vn";
  }

  if (/(note|description|content|reason|remark)/.test(normalizedKey)) {
    return "Ban preview de canh bo cuc va noi dung.";
  }

  if (
    fieldType === "number" ||
    /(count|sessions|days|minutes|hours|percent|rate|score|point|quantity|qty|rank|age|total)/.test(normalizedKey)
  ) {
    return sequence * 3;
  }

  return `${resource.title} ${sequence}`;
};

export const buildResourcePreviewRecord = (resource: ResourceDefinition) => {
  const fieldTypeByKey = new Map<string, string>();

  resource.columns.forEach((column) => {
    if (!fieldTypeByKey.has(column.key)) {
      fieldTypeByKey.set(column.key, column.type || "text");
    }
  });

  resource.fields.forEach((field) => {
    if (!fieldTypeByKey.has(field.name)) {
      fieldTypeByKey.set(field.name, field.type);
    }
  });

  const orderedKeys = Array.from(new Set([...resource.detailFields, ...resource.columns.map((column) => column.key), ...resource.fields.map((field) => field.name)]));

  return Object.fromEntries(
    orderedKeys.map((key, index) => [key, inferPreviewValue(resource, key, fieldTypeByKey.get(key), index)]),
  ) as Record<string, unknown>;
};

export const buildResourceDesignerDataset = (
  resource: ResourceDefinition,
  record: Record<string, unknown>,
  options?: {
    maxSummaryItems?: number;
    maxRows?: number;
  },
) => {
  const maxSummaryItems = options?.maxSummaryItems ?? 4;
  const maxRows = options?.maxRows ?? 12;
  const entries = buildResourcePrintEntries(resource, record);
  const summary = entries.slice(0, maxSummaryItems).map((item) => ({
    label: item.label,
    value: item.value,
    type: item.type,
  }));
  const detailEntries = (entries.length > maxSummaryItems ? entries.slice(maxSummaryItems) : entries).slice(0, maxRows);

  return {
    summary,
    rows: detailEntries.map((item) => ({
      chiTieu: item.label,
      giaTri: item.value,
    })),
    columns: ["chiTieu", "giaTri"],
  };
};
