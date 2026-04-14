import { SocialLinkClaimClient } from "@/components/public/social-link-claim-client";

interface SocialLinkPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tenantKey?: string }>;
}

export default async function SocialLinkPage({ params, searchParams }: SocialLinkPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const sessionToken = String(resolvedParams.token || "").trim();
  const tenantKey = String(resolvedSearchParams.tenantKey || "MASTER").trim().toUpperCase() || "MASTER";

  return <SocialLinkClaimClient sessionToken={sessionToken} tenantKey={tenantKey} />;
}
