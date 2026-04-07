export type LicensePlanCode =
  | "TRIAL_1_MONTH"
  | "SUBSCRIPTION_1_YEAR"
  | "SUBSCRIPTION_3_YEARS"
  | "PERMANENT";

export interface LicenseStatusSummary {
  state: "active" | "warning" | "expired" | "invalid";
  usable: boolean;
  source: "trial" | "license";
  planCode: LicensePlanCode;
  planLabel: string;
  isPermanent: boolean;
  expiresAt: string | null;
  issuedAt: string;
  daysRemaining: number | null;
  machine: {
    hostname: string;
    primaryMac: string | null;
    machineGuid: string | null;
    machineFingerprint: string;
  };
  requestPlanCode: LicensePlanCode;
  requestCode: string;
  unlockCodePresent: boolean;
  detailMessage: string;
  warningMessage: string | null;
  licenseId: string | null;
}
