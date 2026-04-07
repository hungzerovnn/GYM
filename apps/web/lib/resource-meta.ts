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
  "attendance-machines": {
    detailEndpoint: (id) => `/attendance-machines/${id}`,
    entityType: "attendance_machine",
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

  const orderedKeys = Array.from(new Set([...resource.detailFields, ...resource.columns.map((column) => column.key), ...resource.fields.map((field) => field.name)]));

  return orderedKeys
    .map((key) => ({
      label: labels.get(key)?.label || toReadableLabel(key),
      value: extractDisplayValue(record[key]),
      type: labels.get(key)?.type,
    }))
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
};
