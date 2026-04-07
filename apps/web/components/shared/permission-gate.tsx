"use client";

import { useAuth } from "@/lib/auth-context";

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user?.permissions.includes(permission)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
