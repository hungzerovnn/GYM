import { ReportTemplateDesignerPage } from "@/components/portal/report-template-designer-page";
import { settingsRegistry } from "@/lib/settings-registry";

interface ReportTemplateDesignerRouteProps {
  params: Promise<{ templateKey: string }>;
  searchParams: Promise<{ branchId?: string | string[] }>;
}

export default async function ReportTemplateDesignerRoute({
  params,
  searchParams,
}: ReportTemplateDesignerRouteProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const branchId =
    typeof resolvedSearchParams.branchId === "string"
      ? resolvedSearchParams.branchId
      : Array.isArray(resolvedSearchParams.branchId)
        ? resolvedSearchParams.branchId[0] || ""
        : "";

  return (
    <ReportTemplateDesignerPage
      initialBranchId={branchId}
      setting={settingsRegistry["report-templates"]}
      templateKey={resolvedParams.templateKey}
    />
  );
}
