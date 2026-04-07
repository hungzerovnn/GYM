"use client";

import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { LicenseStatusSummary } from "@/types/license";

interface LicenseContextValue {
  licenseStatus: LicenseStatusSummary | null;
  isLoading: boolean;
  isReady: boolean;
  refresh: () => Promise<LicenseStatusSummary | null>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["license-status"],
    queryFn: async () => {
      const response = await api.get<LicenseStatusSummary>("/license");
      return response.data;
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const value = useMemo<LicenseContextValue>(
    () => ({
      licenseStatus: query.data ?? null,
      isLoading: query.isLoading,
      isReady: !query.isLoading,
      refresh: async () => {
        const result = await query.refetch();
        return result.data ?? null;
      },
    }),
    [query],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error("useLicense must be used inside LicenseProvider");
  }
  return context;
};
