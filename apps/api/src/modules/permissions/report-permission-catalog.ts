export type ReportPermissionDefinition = {
  key: string;
  label: string;
  code: string;
  module: string;
  action: 'view';
  description: string;
};

const reportDefinitions: Array<{ key: string; label: string }> = [
  { key: 'kpi', label: 'Bao cao KPI' },
  { key: 'lead', label: 'Bao cao Lead' },
  { key: 'branch-revenue', label: 'Doanh thu chi nhanh' },
  { key: 'contract-remain', label: 'Gia tri hop dong con lai' },
  { key: 'payment', label: 'Bao cao thu chi' },
  { key: 'deposit', label: 'Bao cao tien coc' },
  { key: 'trainer-performance', label: 'Bao cao huan luyen vien' },
  { key: 'birthday', label: 'Sinh nhat hoi vien' },
  { key: 'follow-up', label: 'Cham soc / lich hen' },
  { key: 'checkin', label: 'Bao cao Checkin' },
  { key: 'pt-training', label: 'PT - Training' },
  { key: 'staff-attendance', label: 'Cham cong nhan vien' },
  { key: 'class-attendance', label: 'Cham cong lop' },
  { key: 'allocation', label: 'Bao cao phan bo' },
  { key: 'sales-summary', label: 'Tong hop Sale goi dich vu' },
  { key: 'debt', label: 'Bao cao cong no' },
  { key: 'branch-summary', label: 'Tong hop chi nhanh' },
  { key: 'package-progress', label: 'Goi tap - qua trinh tap' },
  { key: 'card-revenue', label: 'Bao cao doanh thu the luot' },
  { key: 'staff-review', label: 'Bao cao danh gia nhan vien' },
  { key: 'lead-status', label: 'Bao cao trang thai Lead' },
];

export const detailedReportPermissions: ReportPermissionDefinition[] =
  reportDefinitions.map(({ key, label }) => ({
    key,
    label,
    code: `reports-${key}.view`,
    module: `reports-${key}`,
    action: 'view',
    description: `Xem ${label.toLowerCase()}`,
  }));

export const detailedReportPermissionCodes = detailedReportPermissions.map(
  (permission) => permission.code,
);

export const getDetailedReportPermissionCode = (reportKey: string) =>
  detailedReportPermissions.find((permission) => permission.key === reportKey)
    ?.code || `reports-${reportKey}.view`;
