import { formatDateTime } from "./format";
import { translateText } from "./i18n/display";
import type { AppLocale } from "./i18n/runtime";
import type { LicensePlanCode, LicenseStatusSummary } from "@/types/license";

const licensePlanCopy: Record<
  LicensePlanCode,
  {
    label: Record<AppLocale, string>;
    duration: Record<AppLocale, string>;
  }
> = {
  TRIAL_1_MONTH: {
    label: {
      vi: "Dùng thử 1 tháng",
      en: "1-month trial",
      ko: "1개월 체험판",
    },
    duration: {
      vi: "Sử dụng 1 tháng kể từ ngày kích hoạt.",
      en: "Use the system for 1 month from activation.",
      ko: "활성화일부터 1개월 동안 사용할 수 있습니다.",
    },
  },
  SUBSCRIPTION_1_YEAR: {
    label: {
      vi: "Bản quyền 1 năm",
      en: "1-year license",
      ko: "1년 라이선스",
    },
    duration: {
      vi: "Sử dụng 1 năm kể từ ngày kích hoạt.",
      en: "Use the system for 1 year from activation.",
      ko: "활성화일부터 1년 동안 사용할 수 있습니다.",
    },
  },
  SUBSCRIPTION_3_YEARS: {
    label: {
      vi: "Bản quyền 3 năm",
      en: "3-year license",
      ko: "3년 라이선스",
    },
    duration: {
      vi: "Sử dụng 3 năm kể từ ngày kích hoạt.",
      en: "Use the system for 3 years from activation.",
      ko: "활성화일부터 3년 동안 사용할 수 있습니다.",
    },
  },
  PERMANENT: {
    label: {
      vi: "Vĩnh viễn",
      en: "Permanent",
      ko: "영구 라이선스",
    },
    duration: {
      vi: "Không giới hạn thời gian sử dụng.",
      en: "Unlimited usage time.",
      ko: "사용 기간 제한이 없습니다.",
    },
  },
};

export const licensePlanCodes = Object.keys(licensePlanCopy) as LicensePlanCode[];

export function getLicensePlanLabel(planCode: LicensePlanCode, locale: AppLocale) {
  return licensePlanCopy[planCode].label[locale];
}

export function getLicensePlanDuration(planCode: LicensePlanCode, locale: AppLocale) {
  return licensePlanCopy[planCode].duration[locale];
}

export function localizeLicenseMessage(message: string | null | undefined, locale: AppLocale) {
  const normalized = message?.trim();

  if (!normalized) {
    return "";
  }

  const trialWarningMatch = normalized.match(/^(\d+) day\(s\) left in trial mode\. Generate a new key before it expires\.$/);
  if (trialWarningMatch) {
    const [, days] = trialWarningMatch;
    if (locale === "vi") {
      return `Còn ${days} ngày dùng thử. Hãy tạo key mới trước khi hết hạn.`;
    }
    if (locale === "ko") {
      return `체험판이 ${days}일 남았습니다. 만료되기 전에 새 키를 발급하세요.`;
    }
    return `${days} day(s) left in trial mode. Generate a new key before it expires.`;
  }

  const licenseWarningMatch = normalized.match(/^(\d+) day\(s\) left on the license\. Renew before the system gets locked\.$/);
  if (licenseWarningMatch) {
    const [, days] = licenseWarningMatch;
    if (locale === "vi") {
      return `Bản quyền còn ${days} ngày. Hãy gia hạn trước khi hệ thống bị khóa.`;
    }
    if (locale === "ko") {
      return `라이선스가 ${days}일 남았습니다. 시스템이 잠기기 전에 갱신하세요.`;
    }
    return `${days} day(s) left on the license. Renew before the system gets locked.`;
  }

  return translateText(normalized, locale);
}

export function normalizeLicenseCode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function detectLicenseCodeKind(value: string) {
  const normalized = normalizeLicenseCode(value).toUpperCase();

  if (!normalized) {
    return "empty" as const;
  }

  if (normalized.includes("GYM-REQ.")) {
    return "request" as const;
  }

  if (normalized.includes("GYM-KEY.")) {
    return "unlock" as const;
  }

  return "unknown" as const;
}

export function getLicenseSummary(status: LicenseStatusSummary, locale: AppLocale) {
  if (status.isPermanent) {
    if (locale === "vi") {
      return "Bản quyền vĩnh viễn";
    }
    if (locale === "ko") {
      return "영구 라이선스";
    }
    return "Permanent license";
  }

  if (status.daysRemaining === null) {
    if (locale === "vi") {
      return "Sẵn sàng sử dụng";
    }
    if (locale === "ko") {
      return "사용 준비 완료";
    }
    return "Ready to use";
  }

  if (status.daysRemaining < 0) {
    if (locale === "vi") {
      return "Đã hết hạn";
    }
    if (locale === "ko") {
      return "만료됨";
    }
    return "Expired";
  }

  if (locale === "vi") {
    return `Còn ${status.daysRemaining} ngày | hết hạn ${formatDateTime(status.expiresAt, locale)}`;
  }

  if (locale === "ko") {
    return `${status.daysRemaining}일 남음 | 만료 ${formatDateTime(status.expiresAt, locale)}`;
  }

  return `${status.daysRemaining} day(s) left | expires ${formatDateTime(status.expiresAt, locale)}`;
}
