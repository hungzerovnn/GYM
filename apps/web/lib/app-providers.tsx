"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "./auth-context";
import { LocaleProvider } from "./i18n/provider";
import { AppLocale } from "./i18n/runtime";
import { LicenseProvider } from "./license-context";

export function AppProviders({ children, initialLocale }: { children: React.ReactNode; initialLocale: AppLocale }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider initialLocale={initialLocale}>
          <LicenseProvider>
            {children}
            <Toaster position="top-right" richColors />
          </LicenseProvider>
        </LocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
