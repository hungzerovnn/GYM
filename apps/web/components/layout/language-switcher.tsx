"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { localeLabels } from "@/lib/i18n/messages";
import { translateText } from "@/lib/i18n/display";
import { useLocale } from "@/lib/i18n/provider";
import { supportedLocales } from "@/lib/i18n/runtime";

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-600">
      <span>{translateText("Language")}</span>
      <select
        className="border-0 bg-transparent text-[12px] font-medium text-slate-900 outline-none"
        onChange={(event) => {
          const nextLocale = event.target.value as (typeof supportedLocales)[number];
          startTransition(() => {
            setLocale(nextLocale);
            router.refresh();
          });
        }}
        value={locale}
      >
        {supportedLocales.map((item) => (
          <option key={item} value={item}>
            {localeLabels[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
