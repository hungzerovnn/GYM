import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { AppLocale, getCurrentLocale } from "./i18n/runtime";

const localeMap: Record<AppLocale, string> = {
  vi: "vi-VN",
  en: "en-US",
  ko: "ko-KR",
};

const parseDateValue = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const cn = (...inputs: Array<string | false | null | undefined>) => twMerge(clsx(inputs));

export const getIntlLocale = (locale: AppLocale = getCurrentLocale()) => localeMap[locale] || localeMap.vi;

export const formatNumber = (value: number | string | null | undefined, locale: AppLocale = getCurrentLocale()) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 2 }).format(amount);
};

export const formatCurrency = (value: number | string | null | undefined, locale: AppLocale = getCurrentLocale(), currency = "VND") => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(getIntlLocale(locale), { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
};

export const formatDate = (value?: string | Date | null, locale: AppLocale = getCurrentLocale()) => {
  const date = parseDateValue(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export const formatDateTime = (value?: string | Date | null, locale: AppLocale = getCurrentLocale()) => {
  const date = parseDateValue(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};
