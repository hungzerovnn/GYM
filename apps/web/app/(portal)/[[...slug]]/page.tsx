import { DashboardWorkspace } from "@/components/portal/dashboard-workspace";
import { ReportWorkspace } from "@/components/portal/report-workspace";
import { ResourceWorkspace } from "@/components/portal/resource-workspace";
import { SettingsWorkspace } from "@/components/portal/settings-workspace";
import { EmptyState } from "@/components/feedback/empty-state";
import { resolvePortalPage } from "@/lib/module-config";

interface PortalPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const resolved = await params;
  const slug = resolved.slug || [];
  const page = resolvePortalPage(slug);

  if (!page) {
    return <EmptyState title="Page not found" description="The requested module is not available in this portal." />;
  }

  if (page.kind === "dashboard") {
    return <DashboardWorkspace subtitle={page.subtitle} title={page.title} />;
  }

  if (page.kind === "report") {
    return <ReportWorkspace report={page.report} />;
  }

  if (page.kind === "setting") {
    return <SettingsWorkspace setting={page.setting} />;
  }

  return <ResourceWorkspace resource={page.resource} />;
}
