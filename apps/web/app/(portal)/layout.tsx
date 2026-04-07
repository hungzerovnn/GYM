"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { translateText } from "@/lib/i18n/display";
import { useLicense } from "@/lib/license-context";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();
  const { licenseStatus, isReady: isLicenseReady } = useLicense();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isReady, pathname, router]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !isLicenseReady) {
      return;
    }

    if (licenseStatus && !licenseStatus.usable) {
      router.replace(`/license?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLicenseReady, isReady, licenseStatus, pathname, router]);

  if (!isReady || !isLicenseReady) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{translateText("Loading session...")}</div>;
  }

  if (!isAuthenticated || (licenseStatus && !licenseStatus.usable)) {
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
