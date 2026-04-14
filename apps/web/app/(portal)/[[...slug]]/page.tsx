import { DashboardWorkspace } from "@/components/portal/dashboard-workspace";
import { PtScheduleCalendarWorkspace } from "@/components/portal/pt-schedule-calendar-workspace";
import { ReportWorkspace } from "@/components/portal/report-workspace";
import { ResourceWorkspace } from "@/components/portal/resource-workspace";
import { SocialInboxWorkspace } from "@/components/portal/social-inbox-workspace";
import { SettingsWorkspace } from "@/components/portal/settings-workspace";
import { EmptyState } from "@/components/feedback/empty-state";
import { resolvePortalPage } from "@/lib/portal-pages";

interface PortalPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const resolved = await params;
  const slug = resolved.slug || [];
  const page = resolvePortalPage(slug);
  const scheduleBoardKeys = new Set([
    "pt-schedule-calendar",
    "class-schedule-bookings",
    "class-schedule-timetable",
    "class-schedule-group-pt",
    "class-schedule-line-schedule",
  ]);

  if (!page) {
    return <EmptyState title="Page not found" description="The requested module is not available in this portal." />;
  }

  if (page.kind === "dashboard") {
    return <DashboardWorkspace subtitle={page.subtitle} title={page.title} />;
  }

  if (page.kind === "report") {
    if ((page.report.baseKey || page.report.key) === "social-inbox") {
      return <SocialInboxWorkspace report={page.report} />;
    }

    return <ReportWorkspace report={page.report} />;
  }

  if (page.kind === "setting") {
    return <SettingsWorkspace setting={page.setting} />;
  }

  if (page.kind === "resource" && scheduleBoardKeys.has(page.resource.key)) {
    return <PtScheduleCalendarWorkspace resource={page.resource} />;
  }

  return <ResourceWorkspace resource={page.resource} />;
}
