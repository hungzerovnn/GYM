import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const decimal = (value: number) => new Prisma.Decimal(value);
const padNumber = (value: number, length = 4) =>
  value.toString().padStart(length, "0");
const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const addMinutes = (value: Date, minutes: number) => {
  const next = new Date(value);
  next.setUTCMinutes(next.getUTCMinutes() + minutes);
  return next;
};
const withTime = (value: Date, hours: number, minutes = 0) => {
  const next = new Date(value);
  next.setUTCHours(hours, minutes, 0, 0);
  return next;
};

const defaultStaffShiftTemplates = [
  {
    code: "1/2M5",
    name: "1/2M5",
    startTime: "05:00",
    endTime: "09:00",
    breakMinutes: 0,
    workHours: 4,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "M5",
    name: "M5",
    startTime: "05:00",
    endTime: "13:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "M6",
    name: "M6",
    startTime: "06:00",
    endTime: "14:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "M7",
    name: "M7",
    startTime: "07:00",
    endTime: "15:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "M8VH",
    name: "M8VH",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "M8",
    name: "M8",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: 0,
    workHours: 9,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "S001",
    name: "Ca sang",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: 60,
    workHours: 8,
    lateToleranceMinutes: 10,
    earlyLeaveToleranceMinutes: 10,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "1/2A1",
    name: "1/2A1",
    startTime: "13:00",
    endTime: "17:00",
    breakMinutes: 0,
    workHours: 4,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "A2",
    name: "A2",
    startTime: "14:00",
    endTime: "22:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "A3",
    name: "A3",
    startTime: "15:00",
    endTime: "23:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: false,
  },
  {
    code: "NFO",
    name: "NFO",
    startTime: "22:00",
    endTime: "06:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: true,
  },
  {
    code: "NSEC",
    name: "NSEC",
    startTime: "23:00",
    endTime: "07:00",
    breakMinutes: 0,
    workHours: 8,
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    overtimeAfterMinutes: 30,
    mealAllowance: 0,
    nightAllowance: 0,
    isOvernight: true,
  },
] as const;

const modulePermissions = [
  "dashboard",
  "customers",
  "customer-groups",
  "customer-sources",
  "leads",
  "contracts",
  "services",
  "service-packages",
  "trainers",
  "training-sessions",
  "receipts",
  "expenses",
  "lockers",
  "deposits",
  "products",
  "suppliers",
  "purchase-orders",
  "branches",
  "users",
  "roles",
  "permissions",
  "settings",
  "audit-logs",
  "reports",
  "attendance-machines",
  "staff-shifts",
  "staff-shift-assignments",
  "staff-attendance-events",
  "member-presence",
  "attachments",
];

const permissionActions = [
  "view",
  "create",
  "update",
  "delete",
  "restore",
  "approve",
  "export",
  "report",
  "branch_scope",
  "own_scope",
];

const detailedReportPermissions = [
  { key: "kpi", label: "Bao cao KPI" },
  { key: "lead", label: "Bao cao Lead" },
  { key: "branch-revenue", label: "Doanh thu chi nhanh" },
  { key: "contract-remain", label: "Gia tri hop dong con lai" },
  { key: "payment", label: "Bao cao thu chi" },
  { key: "deposit", label: "Bao cao tien coc" },
  { key: "trainer-performance", label: "Bao cao huan luyen vien" },
  { key: "birthday", label: "Sinh nhat hoi vien" },
  { key: "follow-up", label: "Cham soc / lich hen" },
  { key: "checkin", label: "Bao cao Checkin" },
  { key: "pt-training", label: "PT - Training" },
  { key: "staff-attendance", label: "Cham cong nhan vien" },
  { key: "class-attendance", label: "Cham cong lop" },
  { key: "allocation", label: "Bao cao phan bo" },
  { key: "sales-summary", label: "Tong hop Sale goi dich vu" },
  { key: "debt", label: "Bao cao cong no" },
  { key: "branch-summary", label: "Tong hop chi nhanh" },
  { key: "package-progress", label: "Goi tap - qua trinh tap" },
  { key: "card-revenue", label: "Bao cao doanh thu the luot" },
  { key: "staff-review", label: "Bao cao danh gia nhan vien" },
  { key: "lead-status", label: "Bao cao trang thai Lead" },
].map(({ key, label }) => ({
  code: `reports-${key}.view`,
  module: `reports-${key}`,
  action: "view",
  description: `Xem ${label.toLowerCase()}`,
}));

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "login_otp_challenges",
      "audit_logs",
      "notifications",
      "app_settings",
      "birthday_templates",
      "zalo_configs",
      "email_configs",
      "sms_configs",
      "member_presence_sessions",
      "staff_attendance_events",
      "staff_shift_assignment_shifts",
      "staff_shift_assignments",
      "staff_shifts",
      "attendance_machines",
      "purchase_order_items",
      "purchase_orders",
      "suppliers",
      "products",
      "product_categories",
      "deposits",
      "locker_rentals",
      "lockers",
      "payments_expense",
      "payments_receipt",
      "payment_methods",
      "training_attendance",
      "training_sessions",
      "pt_trainers",
      "contract_conversions",
      "contract_histories",
      "contract_items",
      "contracts",
      "service_packages",
      "services",
      "lead_logs",
      "leads",
      "lead_sources",
      "customer_files",
      "attachments",
      "customers",
      "customer_sources",
      "customer_groups",
      "user_roles",
      "role_permissions",
      "permissions",
      "roles",
      "users",
      "branches"
    RESTART IDENTITY CASCADE;
  `);

  const genericPermissions = await prisma.permission.createManyAndReturn({
    data: modulePermissions.flatMap((module) =>
      permissionActions.map((action) => ({
        code: `${module}.${action}`,
        module,
        action,
        description: `${action} ${module}`,
      })),
    ),
  });
  const reportPermissions = await prisma.permission.createManyAndReturn({
    data: detailedReportPermissions,
  });
  const permissions = [...genericPermissions, ...reportPermissions];

  const roles = await prisma.role.createManyAndReturn({
    data: [
      {
        code: "super_admin",
        name: "Super Admin",
        description: "Full access",
        isSystem: true,
      },
      {
        code: "system_owner",
        name: "Chu he thong",
        description: "System owner",
        isSystem: true,
      },
      {
        code: "branch_manager",
        name: "Quan ly chi nhanh",
        description: "Branch manager",
        isSystem: true,
      },
      {
        code: "sales",
        name: "Le tan / Sales",
        description: "Sales and reception",
        isSystem: true,
      },
      {
        code: "accountant",
        name: "Ke toan",
        description: "Finance operations",
        isSystem: true,
      },
      {
        code: "trainer",
        name: "PT / Huan luyen vien",
        description: "Trainer",
        isSystem: true,
      },
      {
        code: "customer_care",
        name: "CSKH",
        description: "Customer care",
        isSystem: true,
      },
      {
        code: "hr",
        name: "Nhan su",
        description: "HR and attendance",
        isSystem: true,
      },
    ],
  });

  const permissionMap = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );
  const roleMap = new Map(roles.map((role) => [role.code, role.id]));

  const grant = async (roleCode: string, codes: string[]) => {
    const roleId = roleMap.get(roleCode)!;
    await prisma.rolePermission.createMany({
      data: codes.map((code) => ({
        roleId,
        permissionId: permissionMap.get(code)!,
      })),
      skipDuplicates: true,
    });
  };

  await grant(
    "super_admin",
    permissions.map((item) => item.code),
  );
  await grant(
    "system_owner",
    permissions
      .map((item) => item.code)
      .filter((code) => !code.startsWith("permissions.delete")),
  );
  await grant(
    "branch_manager",
    permissions
      .filter((item) =>
        [
          "dashboard",
          "customers",
          "leads",
          "contracts",
          "services",
          "service-packages",
          "trainers",
          "training-sessions",
          "receipts",
          "expenses",
          "lockers",
          "deposits",
          "products",
          "suppliers",
          "purchase-orders",
          "reports",
          "audit-logs",
          "attendance-machines",
          "staff-shifts",
          "staff-shift-assignments",
          "staff-attendance-events",
          "member-presence",
          "attachments",
        ].includes(item.module) ||
        (
          [
            "branches",
            "users",
            "customer-groups",
            "customer-sources",
          ].includes(item.module) &&
          item.action === "view"
        ),
      )
      .map((item) => item.code),
  );
  await grant(
    "sales",
    permissions
      .filter(
        (item) =>
          (
            [
              "dashboard",
              "customers",
              "leads",
              "member-presence",
              "contracts",
              "receipts",
              "attachments",
              "reports",
            ].includes(item.module) &&
            !["delete", "approve"].includes(item.action)
          ) ||
          (
            [
              "branches",
              "users",
              "customer-groups",
              "customer-sources",
              "service-packages",
              "trainers",
            ].includes(item.module) &&
            item.action === "view"
          ),
      )
      .map((item) => item.code),
  );
  await grant(
    "accountant",
    permissions
      .filter(
        (item) =>
          (
            [
              "dashboard",
              "receipts",
              "expenses",
              "reports",
              "contracts",
              "customers",
              "audit-logs",
            ].includes(item.module) &&
            !["delete"].includes(item.action)
          ) ||
          (
            [
              "branches",
              "users",
              "customer-groups",
              "customer-sources",
              "service-packages",
              "trainers",
            ].includes(item.module) &&
            item.action === "view"
          ),
      )
      .map((item) => item.code),
  );
  await grant(
    "trainer",
    permissions
      .filter(
        (item) =>
          (
            [
              "dashboard",
              "customers",
              "member-presence",
              "trainers",
              "training-sessions",
              "reports",
            ].includes(item.module) &&
            !["delete", "approve"].includes(item.action)
          ) ||
          (
            ["branches", "contracts", "users", "customer-groups", "customer-sources"].includes(item.module) &&
            item.action === "view"
          ),
      )
      .map((item) => item.code),
  );
  await grant(
    "customer_care",
    permissions
      .filter(
        (item) =>
          (
            [
              "dashboard",
              "customers",
              "leads",
              "member-presence",
              "reports",
              "attachments",
            ].includes(item.module) &&
            !["delete", "approve"].includes(item.action)
          ) ||
          (
            ["branches", "users", "customer-groups", "customer-sources"].includes(item.module) &&
            item.action === "view"
          ),
      )
      .map((item) => item.code),
  );
  await grant(
    "hr",
    permissions
      .filter(
        (item) =>
          (
            [
              "dashboard",
              "users",
              "branches",
              "attendance-machines",
              "staff-shifts",
              "staff-shift-assignments",
              "staff-attendance-events",
              "member-presence",
              "settings",
              "reports",
            ].includes(item.module) && !["delete"].includes(item.action)
          ) ||
          (item.module === "roles" && item.action === "view"),
      )
      .map((item) => item.code),
  );

  const detailedReportPermissionCodes = detailedReportPermissions.map(
    (permission) => permission.code,
  );
  for (const roleCode of [
    "super_admin",
    "system_owner",
    "branch_manager",
    "sales",
    "accountant",
    "trainer",
    "customer_care",
    "hr",
  ]) {
    await grant(roleCode, detailedReportPermissionCodes);
  }

  const hq = await prisma.branch.create({
    data: {
      code: "BKK-HQ",
      name: "FitFlow Central",
      phone: "0280000001",
      email: "hq@fitflow.local",
      address: "101 Nguyen Hue, District 1, Ho Chi Minh City",
      openingTime: "05:30",
      closingTime: "22:00",
      maxDepositHours: 48,
      maxBookingsPerDay: 180,
      requiresDeposit: true,
      note: "Flagship branch with sales and PT operations.",
    },
  });

  const east = await prisma.branch.create({
    data: {
      code: "BKK-EAST",
      name: "FitFlow East",
      phone: "0280000002",
      email: "east@fitflow.local",
      address: "25 Xa Lo Ha Noi, Thu Duc City",
      openingTime: "05:00",
      closingTime: "21:30",
      maxDepositHours: 24,
      maxBookingsPerDay: 120,
      requiresDeposit: false,
      note: "Growing branch focused on lead conversion.",
    },
  });

  await prisma.staffShift.createMany({
    data: [hq.id, east.id].flatMap((branchId) =>
      defaultStaffShiftTemplates.map((shift) => ({
        branchId,
        ...shift,
      })),
    ),
  });

  const passwordHash = await hash("Admin@123", 10);

  const users = await prisma.user.createManyAndReturn({
    data: [
      {
        username: "admin",
        employeeCode: "EMP-ADMIN",
        attendanceCode: "AT-ADMIN",
        fullName: "System Administrator",
        email: "admin@fitflow.local",
        phone: "0901000001",
        title: "Super Admin",
        passwordHash,
      },
      {
        username: "owner",
        employeeCode: "EMP-OWNER",
        attendanceCode: "AT-OWNER",
        fullName: "Nguyen Minh Owner",
        email: "owner@fitflow.local",
        phone: "0901000002",
        title: "Owner",
        passwordHash,
      },
      {
        username: "manager",
        employeeCode: "EMP-0001",
        attendanceCode: "AT-0001",
        fullName: "Tran Lan Manager",
        email: "manager@fitflow.local",
        phone: "0901000003",
        title: "Branch Manager",
        branchId: hq.id,
        passwordHash,
      },
      {
        username: "sales",
        employeeCode: "EMP-0002",
        attendanceCode: "AT-0002",
        fullName: "Le Hoang Sales",
        email: "sales@fitflow.local",
        phone: "0901000004",
        title: "Sales Executive",
        branchId: hq.id,
        passwordHash,
      },
      {
        username: "accountant",
        employeeCode: "EMP-0003",
        attendanceCode: "AT-0003",
        fullName: "Pham Thu Accountant",
        email: "accountant@fitflow.local",
        phone: "0901000005",
        title: "Chief Accountant",
        branchId: hq.id,
        passwordHash,
      },
      {
        username: "trainer",
        employeeCode: "EMP-0004",
        attendanceCode: "AT-0004",
        fullName: "Doan Huy Trainer",
        email: "trainer@fitflow.local",
        phone: "0901000006",
        title: "Senior PT",
        branchId: hq.id,
        passwordHash,
      },
      {
        username: "hr",
        employeeCode: "EMP-0005",
        attendanceCode: "AT-0005",
        fullName: "Bui Mai HR",
        email: "hr@fitflow.local",
        phone: "0901000008",
        title: "HR Executive",
        branchId: hq.id,
        passwordHash,
      },
      {
        username: "cskh",
        employeeCode: "EMP-0006",
        attendanceCode: "AT-0006",
        fullName: "Vu Anh CSKH",
        email: "cskh@fitflow.local",
        phone: "0901000007",
        title: "Customer Care",
        branchId: east.id,
        passwordHash,
      },
    ],
  });

  const userMap = new Map(users.map((user) => [user.username, user]));
  await prisma.userRole.createMany({
    data: [
      { userId: userMap.get("admin")!.id, roleId: roleMap.get("super_admin")! },
      {
        userId: userMap.get("owner")!.id,
        roleId: roleMap.get("system_owner")!,
      },
      {
        userId: userMap.get("manager")!.id,
        roleId: roleMap.get("branch_manager")!,
      },
      { userId: userMap.get("sales")!.id, roleId: roleMap.get("sales")! },
      {
        userId: userMap.get("accountant")!.id,
        roleId: roleMap.get("accountant")!,
      },
      { userId: userMap.get("trainer")!.id, roleId: roleMap.get("trainer")! },
      { userId: userMap.get("hr")!.id, roleId: roleMap.get("hr")! },
      {
        userId: userMap.get("cskh")!.id,
        roleId: roleMap.get("customer_care")!,
      },
    ],
  });

  const [vipGroup, corporateGroup] =
    await prisma.customerGroup.createManyAndReturn({
      data: [
        {
          code: "VIP",
          name: "VIP",
          description: "High value members",
          color: "#16a34a",
        },
        {
          code: "CORP",
          name: "Corporate",
          description: "Corporate group",
          color: "#0f766e",
        },
      ],
    });

  const [facebookSource, walkinSource] =
    await prisma.customerSource.createManyAndReturn({
      data: [
        {
          code: "FACEBOOK",
          name: "Facebook",
          channel: "Social",
          description: "Paid social lead",
        },
        {
          code: "WALKIN",
          name: "Walk-in",
          channel: "Offline",
          description: "Walk in customer",
        },
      ],
    });

  const [adsLeadSource, referralLeadSource, websiteLeadSource] =
    await prisma.leadSource.createManyAndReturn({
      data: [
        { code: "ADS", name: "Facebook Ads", channel: "Social" },
        { code: "REF", name: "Referral", channel: "Referral" },
        { code: "WEB", name: "Website", channel: "Online" },
      ],
    });

  const paymentMethods = await prisma.paymentMethod.createManyAndReturn({
    data: [
      { code: "CASH", name: "Tien mat", type: "cash" },
      { code: "BANK", name: "Chuyen khoan", type: "bank" },
      { code: "CARD", name: "The POS", type: "card" },
      { code: "EWALLET", name: "Vi dien tu", type: "wallet" },
    ],
  });

  const cashMethod = paymentMethods.find((item) => item.code === "CASH")!;
  const bankMethod = paymentMethods.find((item) => item.code === "BANK")!;

  const services = await prisma.service.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        code: "GYM",
        name: "Gym Membership",
        category: "membership",
        description: "General gym access package",
        defaultPrice: decimal(1200000),
        durationDays: 30,
        defaultSessions: 30,
      },
      {
        branchId: hq.id,
        code: "PT",
        name: "Personal Training",
        category: "training",
        description: "Personal training program",
        defaultPrice: decimal(7500000),
        durationDays: 60,
        defaultSessions: 12,
      },
      {
        branchId: east.id,
        code: "YOGA",
        name: "Yoga Class",
        category: "class",
        description: "Yoga membership",
        defaultPrice: decimal(1800000),
        durationDays: 30,
        defaultSessions: 16,
      },
    ],
  });

  const gymService = services.find((item) => item.code === "GYM")!;
  const ptService = services.find((item) => item.code === "PT")!;

  const servicePackages = await prisma.servicePackage.createManyAndReturn({
    data: [
      {
        serviceId: gymService.id,
        code: "GYM-03M",
        name: "Gym 3 Thang",
        price: decimal(3300000),
        sessionCount: 90,
        bonusSessions: 0,
        durationDays: 90,
        packageType: "membership",
        remainingValueRule: "pro_rata_by_days",
      },
      {
        serviceId: ptService.id,
        code: "PT-12",
        name: "PT 12 Buoi",
        price: decimal(8500000),
        sessionCount: 12,
        bonusSessions: 2,
        durationDays: 60,
        packageType: "pt",
        remainingValueRule: "pro_rata_by_sessions",
      },
      {
        serviceId: ptService.id,
        code: "PT-24",
        name: "PT 24 Buoi",
        price: decimal(15800000),
        sessionCount: 24,
        bonusSessions: 4,
        durationDays: 120,
        packageType: "pt",
        remainingValueRule: "pro_rata_by_sessions",
      },
    ],
  });

  const pt12Package = servicePackages.find((item) => item.code === "PT-12")!;
  const pt24Package = servicePackages.find((item) => item.code === "PT-24")!;
  const gym3mPackage = servicePackages.find((item) => item.code === "GYM-03M")!;

  const trainerProfiles = await prisma.ptTrainer.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        code: "PT001",
        fullName: "Doan Huy Trainer",
        phone: "0901000006",
        email: "trainer@fitflow.local",
        specialty: "Weight loss and mobility",
        note: "Top trainer seed profile",
      },
      {
        branchId: hq.id,
        code: "PT002",
        fullName: "Nguyen Nhat Anh",
        phone: "0901000016",
        email: "nhatanh.trainer@fitflow.local",
        specialty: "Strength and conditioning",
        note: "Focus on hypertrophy and progressive overload.",
      },
      {
        branchId: east.id,
        code: "PT003",
        fullName: "Tran Bao Long",
        phone: "0901000017",
        email: "baolong.trainer@fitflow.local",
        specialty: "Mobility and beginner transformation",
        note: "Supports East branch PT and group conditioning.",
      },
    ],
  });
  const trainerMap = new Map(trainerProfiles.map((item) => [item.code, item]));
  const trainerProfile = trainerMap.get("PT001")!;
  const hqTrainerPool = [trainerMap.get("PT001")!, trainerMap.get("PT002")!];
  const eastTrainer = trainerMap.get("PT003")!;

  const referenceMemberNames = [
    { fullName: "Le Gia Bao", gender: "MALE" },
    { fullName: "Tran Ngoc Mai", gender: "FEMALE" },
    { fullName: "Vo Minh Khang", gender: "MALE" },
    { fullName: "Phan Thu Ha", gender: "FEMALE" },
    { fullName: "Dang Quoc Huy", gender: "MALE" },
    { fullName: "Bui Khanh Linh", gender: "FEMALE" },
    { fullName: "Nguyen Duc Tam", gender: "MALE" },
    { fullName: "Hoang Bao Chau", gender: "FEMALE" },
    { fullName: "Do Tuan Kiet", gender: "MALE" },
    { fullName: "Ly Thanh Truc", gender: "FEMALE" },
    { fullName: "Truong Quoc Dat", gender: "MALE" },
    { fullName: "Pham Nha Uyen", gender: "FEMALE" },
    { fullName: "Vo Hong Son", gender: "MALE" },
    { fullName: "Mai Thao Nhi", gender: "FEMALE" },
    { fullName: "Ngo Anh Tuan", gender: "MALE" },
    { fullName: "Ta My Duyen", gender: "FEMALE" },
    { fullName: "Lam Gia Huy", gender: "MALE" },
    { fullName: "Duong Bao Ngoc", gender: "FEMALE" },
    { fullName: "Le Quang Minh", gender: "MALE" },
    { fullName: "Vu Ngoc Han", gender: "FEMALE" },
    { fullName: "Phung Thanh Nhan", gender: "MALE" },
  ] as const;
  const openLeadProspects = [
    "Nguyen Quynh Nhu",
    "Tran Phuc Khang",
    "Le Tuong Vy",
    "Hoang Minh Quan",
    "Pham Ha My",
    "Vo Anh Khoa",
    "Bui Bao Yen",
    "Dang Gia Huy",
    "Ta Khanh Vi",
  ];
  const occupations = [
    "Office Manager",
    "Marketing Executive",
    "Software Engineer",
    "Teacher",
    "Pharmacist",
    "Architect",
    "Sales Supervisor",
    "Interior Designer",
  ];
  const hqLocations = [
    { district: "District 1", ward: "Ben Nghe", street: "Nguyen Du" },
    { district: "District 3", ward: "Vo Thi Sau", street: "Pasteur" },
    { district: "Phu Nhuan", ward: "Ward 8", street: "Hoang Van Thu" },
    { district: "Binh Thanh", ward: "Ward 22", street: "Dien Bien Phu" },
  ];
  const eastLocations = [
    { district: "District 9", ward: "Tang Nhon Phu A", street: "Le Van Viet" },
    { district: "Thu Duc", ward: "Linh Tay", street: "Kha Van Can" },
    { district: "Thu Duc", ward: "Hiep Binh Chanh", street: "Pham Van Dong" },
    { district: "District 2", ward: "An Phu", street: "Song Hanh" },
  ];

  const referenceMemberProfiles = referenceMemberNames.map((person, index) => {
    const sequence = index + 4;
    const branch = index % 3 === 0 ? east : hq;
    const assignedUserId =
      branch.id === hq.id ? userMap.get("sales")!.id : userMap.get("cskh")!.id;
    const isPtContract = index % 2 === 0;
    const usesPt24 = isPtContract && index % 4 === 0;
    const packageRecord = isPtContract
      ? usesPt24
        ? pt24Package
        : pt12Package
      : gym3mPackage;
    const totalSessions = isPtContract ? (usesPt24 ? 28 : 14) : 90;
    const bonusSessions = isPtContract ? (usesPt24 ? 4 : 2) : 0;
    const contractStatus =
      index % 9 === 0 ? "EXPIRED" : index % 7 === 0 ? "PAUSED" : "ACTIVE";
    const durationDays = isPtContract ? (usesPt24 ? 120 : 60) : 90;
    const startDate =
      contractStatus === "EXPIRED"
        ? addDays(new Date("2025-12-18T00:00:00Z"), index * 5)
        : addDays(new Date("2026-01-14T00:00:00Z"), index * 4);
    const endDate = addDays(startDate, durationDays);
    const usedSessions =
      contractStatus === "EXPIRED"
        ? Math.max(totalSessions - (isPtContract ? 1 : 6), 0)
        : isPtContract
          ? Math.min(totalSessions - 1, 2 + (index % 5) * 2)
          : Math.min(totalSessions - 10, 12 + (index % 6) * 9);
    const remainingSessions = Math.max(totalSessions - usedSessions, 0);
    const unitPrice = isPtContract
      ? usesPt24
        ? 15800000
        : 8500000
      : branch.id === hq.id
        ? 3300000
        : 3000000;
    const totalDiscount = isPtContract
      ? [300000, 500000, 700000][index % 3]
      : [0, 100000, 200000, 300000][index % 4];
    const totalAmount = unitPrice - totalDiscount;
    const plannedDue =
      contractStatus === "EXPIRED"
        ? 0
        : [0, 300000, 450000, 600000, 900000, 1200000][index % 6];
    const amountDue = Math.min(plannedDue, totalAmount - 100000);
    const amountPaid = totalAmount - amountDue;
    const remainingValue =
      contractStatus === "EXPIRED"
        ? 0
        : Math.round((totalAmount * remainingSessions) / totalSessions);
    const location =
      branch.id === hq.id
        ? hqLocations[index % hqLocations.length]
        : eastLocations[index % eastLocations.length];
    const birthYear =
      person.gender === "MALE" ? 1988 + (index % 8) : 1990 + (index % 7);
    const birthMonth = String((index % 12) + 1).padStart(2, "0");
    const birthDay = String((index % 27) + 1).padStart(2, "0");
    const trainerId = isPtContract
      ? branch.id === hq.id
        ? hqTrainerPool[index % hqTrainerPool.length].id
        : eastTrainer.id
      : undefined;

    return {
      branchId: branch.id,
      assignedUserId,
      groupId:
        index % 5 === 0
          ? vipGroup.id
          : index % 4 === 0
            ? corporateGroup.id
            : undefined,
      customerSourceId: index % 2 === 0 ? facebookSource.id : walkinSource.id,
      leadSourceId:
        index % 3 === 0
          ? referralLeadSource.id
          : index % 3 === 1
            ? websiteLeadSource.id
            : adsLeadSource.id,
      customerCode: `CUS${padNumber(sequence)}`,
      contractCode: `CTR${padNumber(sequence)}`,
      receiptCode: `RCP${padNumber(sequence)}`,
      fullName: person.fullName,
      gender: person.gender,
      birthDate: new Date(`${birthYear}-${birthMonth}-${birthDay}T00:00:00Z`),
      phone: `091222${String(sequence).padStart(4, "0")}`,
      phoneSecondary: `091233${String(sequence).padStart(4, "0")}`,
      phoneTertiary: `091244${String(sequence).padStart(4, "0")}`,
      email: `member${padNumber(sequence)}@fitflow.local`,
      contactName: `${person.fullName} Contact`,
      contactPhone: `090977${String(sequence).padStart(4, "0")}`,
      customerCardNumber: `CARD-${padNumber(sequence)}`,
      fingerprintCode: `AT-CUS-${padNumber(sequence)}`,
      identityNumber: `0791${String(sequence).padStart(8, "0")}`,
      identityIssueDate: addDays(new Date("2019-01-10T00:00:00Z"), index * 35),
      identityIssuePlace:
        branch.id === hq.id ? "Cong an TP.HCM" : "Cong an Thu Duc",
      occupation: occupations[index % occupations.length],
      city: branch.id === hq.id ? "Ho Chi Minh City" : "Thu Duc City",
      district: location.district,
      ward: location.ward,
      address: `${18 + index} ${location.street}`,
      referralName: index % 2 === 0 ? "Member referral" : "Campaign walk-in",
      registrationDate: addDays(startDate, -7),
      startTrainingDate: startDate,
      endTrainingDate: endDate,
      membershipStatus:
        contractStatus === "EXPIRED"
          ? "EXPIRED"
          : contractStatus === "PAUSED"
            ? "SUSPENDED"
            : "ACTIVE",
      outstandingDebt: amountDue,
      profileCount: (index % 3) + 1,
      cardCovid: index % 4 === 0 ? "Da xac minh" : "Theo doi dinh ky",
      otherInfo: isPtContract
        ? "Uu tien muc tieu giam mo va cai thien the luc."
        : "Tap tu do, uu tien khung gio chieu toi.",
      serviceNote: isPtContract
        ? `Dang theo ${packageRecord.name}.`
        : "Hoi vien gym co lich tap co dinh theo tuan.",
      note:
        contractStatus === "PAUSED"
          ? "Tam dung tap 1 thoi gian vi lich cong tac."
          : "Du lieu tham chieu de test doi chieu bao cao.",
      leadDemand: isPtContract
        ? "PT transformation package"
        : "Gym membership and body composition follow-up",
      campaign:
        branch.id === hq.id
          ? "Digital Performance Q1"
          : "East Branch Referral Drive",
      leadStatus: index < 12 ? "CONVERTED" : undefined,
      budgetExpected: totalAmount + 500000,
      contractType: isPtContract ? "pt_package" : "membership",
      serviceId: isPtContract ? ptService.id : gymService.id,
      servicePackageId: packageRecord.id,
      packageName: packageRecord.name,
      totalSessions,
      usedSessions,
      remainingSessions,
      bonusSessions,
      unitPrice,
      grossAmount: unitPrice,
      totalDiscount,
      totalAmount,
      amountPaid,
      amountDue,
      remainingValue,
      paymentStatus: amountDue === 0 ? "PAID" : "PARTIAL",
      status: contractStatus,
      trainerId,
      richNote: isPtContract
        ? `<p>${packageRecord.name} voi lich kiem tra form dinh ky.</p>`
        : undefined,
      receiptDate: withTime(
        addDays(startDate, 1),
        branch.id === hq.id ? 9 : 8,
        index % 2 === 0 ? 15 : 45,
      ),
    };
  });

  const referenceLeadProfiles = [
    ...referenceMemberProfiles.slice(0, 12).map((profile, index) => ({
      code: `LEAD${padNumber(index + 4)}`,
      branchId: profile.branchId,
      sourceId: profile.leadSourceId,
      assignedToId: profile.assignedUserId,
      convertedCustomerCode: profile.customerCode,
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      demand: profile.leadDemand,
      campaign: profile.campaign,
      status: "CONVERTED",
      potentialLevel: index % 3 === 0 ? "HOT" : "WARM",
      nextFollowUpAt: withTime(
        addDays(profile.registrationDate, 2),
        3 + (index % 4),
        0,
      ),
      appointmentAt: withTime(
        addDays(profile.registrationDate, 4),
        3 + (index % 3),
        0,
      ),
      careNote: `Lead ${profile.fullName} da chuyen doi thanh hoi vien demo.`,
      lastContactResult: "Closed won",
      budgetExpected: profile.budgetExpected,
      convertedAt: withTime(
        addDays(profile.registrationDate, 4),
        4 + (index % 3),
        0,
      ),
    })),
    ...openLeadProspects.map((fullName, index) => {
      const sequence = index + 16;
      const branch = index % 3 === 0 ? east : hq;
      const status = [
        "NEW",
        "CONSULTING",
        "APPOINTED",
        "QUOTED",
        "OPEN",
        "CANCELLED",
        "CONSULTING",
        "APPOINTED",
        "NEW",
      ][index] as const;
      return {
        code: `LEAD${padNumber(sequence)}`,
        branchId: branch.id,
        sourceId: index % 2 === 0 ? websiteLeadSource.id : adsLeadSource.id,
        assignedToId:
          branch.id === hq.id
            ? userMap.get("sales")!.id
            : userMap.get("cskh")!.id,
        fullName,
        phone: `091355${String(sequence).padStart(4, "0")}`,
        email: `lead${padNumber(sequence)}@fitflow.local`,
        demand:
          index % 2 === 0
            ? "Gym + nutrition consultation"
            : "PT package comparison",
        campaign:
          branch.id === hq.id
            ? "Landing Page April"
            : "Community outreach April",
        status,
        potentialLevel:
          index % 3 === 0 ? "HOT" : index % 3 === 1 ? "WARM" : "COLD",
        nextFollowUpAt:
          status === "CANCELLED"
            ? undefined
            : withTime(
                addDays(new Date("2026-04-01T00:00:00Z"), index),
                2 + (index % 5),
                30,
              ),
        appointmentAt: ["APPOINTED", "QUOTED"].includes(status)
          ? withTime(addDays(new Date("2026-04-04T00:00:00Z"), index % 4), 3, 0)
          : undefined,
        careNote:
          status === "CANCELLED"
            ? "Khach tam dung nhu cau sau khi nhan bao gia."
            : "Du lieu lead tham chieu de test bo loc va follow-up.",
        lastContactResult:
          status === "NEW"
            ? "Chua lien he"
            : status === "CANCELLED"
              ? "Khach chua co nhu cau"
              : status === "APPOINTED"
                ? "Da hen lich tu van"
                : "Dang so sanh goi tap",
        budgetExpected: 2500000 + index * 750000,
      };
    }),
  ];

  const customers = await prisma.customer.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        groupId: vipGroup.id,
        sourceId: walkinSource.id,
        assignedToId: userMap.get("sales")!.id,
        code: "CUS0001",
        fullName: "Nguyen Thi Anh",
        gender: "FEMALE",
        birthDate: new Date("1996-04-15"),
        phone: "0911111111",
        phoneSecondary: "0911111199",
        email: "anh.nguyen@example.com",
        contactName: "Nguyen Thi Hong",
        contactPhone: "0909888001",
        customerCardNumber: "CARD-0001",
        fingerprintCode: "FP-0001",
        identityNumber: "079096000001",
        identityIssueDate: new Date("2020-04-12"),
        identityIssuePlace: "Cong an TP.HCM",
        occupation: "Office Manager",
        city: "Ho Chi Minh City",
        district: "District 1",
        ward: "Ben Nghe",
        address: "2 Nguyen Du",
        referralName: "Tran Thu Referral",
        registrationDate: new Date("2026-01-03"),
        startTrainingDate: new Date("2026-01-04"),
        endTrainingDate: new Date("2026-04-04"),
        cardCovid: "THE-001 / Covid OK",
        otherInfo: "Khach uu tien PT giam mo, hay tap buoi sang.",
        profileCount: 2,
        serviceNote: "Dang theo goi PT 12 buoi kem gym 3 thang.",
        membershipStatus: "ACTIVE",
        outstandingDebt: decimal(1500000),
        note: "Interested in PT and premium coaching.",
      },
      {
        branchId: hq.id,
        groupId: corporateGroup.id,
        sourceId: facebookSource.id,
        assignedToId: userMap.get("sales")!.id,
        code: "CUS0002",
        fullName: "Tran Van Binh",
        gender: "MALE",
        birthDate: new Date("1992-04-08"),
        phone: "0911111112",
        phoneSecondary: "0911111122",
        email: "binh.tran@example.com",
        contactName: "Tran Bich Ngoc",
        contactPhone: "0909888002",
        customerCardNumber: "CARD-0002",
        fingerprintCode: "FP-0002",
        identityNumber: "079092000002",
        identityIssueDate: new Date("2019-08-15"),
        identityIssuePlace: "Cong an TP.HCM",
        occupation: "Software Engineer",
        city: "Ho Chi Minh City",
        district: "District 3",
        ward: "Vo Thi Sau",
        address: "5 Pasteur",
        registrationDate: new Date("2026-02-10"),
        startTrainingDate: new Date("2026-02-12"),
        endTrainingDate: new Date("2026-05-12"),
        cardCovid: "THE-002",
        otherInfo: "Khach tap sang som, co nhu cau gym + functional.",
        profileCount: 1,
        serviceNote: "Hoi vien thuong, co kha nang nang cap PT.",
        membershipStatus: "ACTIVE",
        outstandingDebt: decimal(0),
        note: "Regular morning training member.",
      },
      {
        branchId: east.id,
        sourceId: walkinSource.id,
        assignedToId: userMap.get("cskh")!.id,
        code: "CUS0003",
        fullName: "Pham Thanh Ha",
        gender: "FEMALE",
        birthDate: new Date("1989-11-03"),
        phone: "0911111113",
        phoneTertiary: "0911111133",
        email: "ha.pham@example.com",
        contactName: "Pham Quang Minh",
        contactPhone: "0909888003",
        customerCardNumber: "CARD-0003",
        fingerprintCode: "FP-0003",
        identityNumber: "079089000003",
        identityIssueDate: new Date("2018-11-20"),
        identityIssuePlace: "Cong an Thu Duc",
        occupation: "Teacher",
        city: "Thu Duc City",
        district: "District 9",
        ward: "Tang Nhon Phu A",
        address: "19 Le Van Viet",
        referralName: "Le Kim Referral",
        registrationDate: new Date("2026-03-01"),
        startTrainingDate: new Date("2026-03-03"),
        endTrainingDate: new Date("2026-06-03"),
        cardCovid: "THE-003 / Covid nhac cap nhat",
        otherInfo: "Can nhac lich tap va gia han hop dong som.",
        profileCount: 3,
        serviceNote: "Khach co them nguoi nha di cung theo profile.",
        membershipStatus: "ACTIVE",
        outstandingDebt: decimal(600000),
        note: "Needs attendance reminders.",
      },
      ...referenceMemberProfiles.map((profile) => ({
        branchId: profile.branchId,
        groupId: profile.groupId,
        sourceId: profile.customerSourceId,
        assignedToId: profile.assignedUserId,
        code: profile.customerCode,
        fullName: profile.fullName,
        gender: profile.gender,
        birthDate: profile.birthDate,
        phone: profile.phone,
        phoneSecondary: profile.phoneSecondary,
        phoneTertiary: profile.phoneTertiary,
        email: profile.email,
        contactName: profile.contactName,
        contactPhone: profile.contactPhone,
        customerCardNumber: profile.customerCardNumber,
        fingerprintCode: profile.fingerprintCode,
        identityNumber: profile.identityNumber,
        identityIssueDate: profile.identityIssueDate,
        identityIssuePlace: profile.identityIssuePlace,
        occupation: profile.occupation,
        city: profile.city,
        district: profile.district,
        ward: profile.ward,
        address: profile.address,
        referralName: profile.referralName,
        registrationDate: profile.registrationDate,
        startTrainingDate: profile.startTrainingDate,
        endTrainingDate: profile.endTrainingDate,
        cardCovid: profile.cardCovid,
        otherInfo: profile.otherInfo,
        profileCount: profile.profileCount,
        serviceNote: profile.serviceNote,
        membershipStatus: profile.membershipStatus,
        outstandingDebt: decimal(profile.outstandingDebt),
        note: profile.note,
      })),
    ],
  });

  const customerMap = new Map(customers.map((item) => [item.code, item]));
  const customerAnh = customers.find((item) => item.code === "CUS0001")!;
  const customerBinh = customers.find((item) => item.code === "CUS0002")!;
  const customerHa = customers.find((item) => item.code === "CUS0003")!;

  const leads = await prisma.lead.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        sourceId: adsLeadSource.id,
        assignedToId: userMap.get("sales")!.id,
        convertedCustomerId: customerAnh.id,
        code: "LEAD0001",
        fullName: "Nguyen Thi Anh",
        phone: "0911111111",
        email: "anh.nguyen@example.com",
        demand: "Weight loss with PT support",
        campaign: "March Fitness Ads",
        status: "CONVERTED",
        potentialLevel: "HOT",
        nextFollowUpAt: new Date("2026-04-02T10:00:00Z"),
        appointmentAt: new Date("2026-03-18T10:00:00Z"),
        careNote: "Converted to PT package after trial session",
        lastContactResult: "Closed won",
        budgetExpected: decimal(9000000),
        convertedAt: new Date("2026-03-18T11:00:00Z"),
      },
      {
        branchId: hq.id,
        sourceId: websiteLeadSource.id,
        assignedToId: userMap.get("sales")!.id,
        code: "LEAD0002",
        fullName: "Hoang Nam",
        phone: "0911111114",
        email: "nam.hoang@example.com",
        demand: "Muscle gain program",
        campaign: "SEO Website",
        status: "APPOINTED",
        potentialLevel: "WARM",
        nextFollowUpAt: new Date("2026-04-03T03:00:00Z"),
        appointmentAt: new Date("2026-04-04T03:00:00Z"),
        careNote: "Requested package comparison",
        lastContactResult: "Appointment booked",
        budgetExpected: decimal(6000000),
      },
      {
        branchId: east.id,
        sourceId: referralLeadSource.id,
        assignedToId: userMap.get("cskh")!.id,
        code: "LEAD0003",
        fullName: "Le Minh Chau",
        phone: "0911111115",
        email: "chau.le@example.com",
        demand: "Yoga and flexibility",
        campaign: "Member referral",
        status: "CONSULTING",
        potentialLevel: "HOT",
        nextFollowUpAt: new Date("2026-04-02T08:00:00Z"),
        careNote: "Very interested after referral from friend",
        lastContactResult: "Need payment plan",
        budgetExpected: decimal(2500000),
      },
      ...referenceLeadProfiles.map((lead) => ({
        branchId: lead.branchId,
        sourceId: lead.sourceId,
        assignedToId: lead.assignedToId,
        convertedCustomerId: lead.convertedCustomerCode
          ? customerMap.get(lead.convertedCustomerCode)?.id
          : undefined,
        code: lead.code,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        demand: lead.demand,
        campaign: lead.campaign,
        status: lead.status,
        potentialLevel: lead.potentialLevel,
        nextFollowUpAt: lead.nextFollowUpAt,
        appointmentAt: lead.appointmentAt,
        careNote: lead.careNote,
        lastContactResult: lead.lastContactResult,
        budgetExpected: decimal(lead.budgetExpected),
        convertedAt: lead.convertedAt,
      })),
    ],
  });

  const leadMap = new Map(leads.map((item) => [item.code, item]));
  const leadAnh = leadMap.get("LEAD0001")!;
  await prisma.leadLog.createMany({
    data: [
      {
        leadId: leadAnh.id,
        activityType: "CALL",
        content: "Initial qualification call",
        result: "Booked trial session",
        performedById: userMap.get("sales")!.id,
        contactAt: new Date("2026-03-15T09:00:00Z"),
      },
      {
        leadId: leadAnh.id,
        activityType: "MEETING",
        content: "In-person consultation and body scan",
        result: "Converted to customer",
        performedById: userMap.get("sales")!.id,
        contactAt: new Date("2026-03-18T10:00:00Z"),
      },
      ...referenceLeadProfiles.flatMap((lead, index) => {
        const targetLead = leadMap.get(lead.code)!;
        const assignedUserId = lead.assignedToId;
        const baseContactAt = addDays(
          new Date("2026-03-05T09:00:00Z"),
          index * 2,
        );

        if (lead.status === "CONVERTED") {
          return [
            {
              leadId: targetLead.id,
              activityType: "CALL",
              content: "Initial discovery call for demo member reference flow",
              result: "Qualified and invited for trial session",
              performedById: assignedUserId,
              contactAt: baseContactAt,
            },
            {
              leadId: targetLead.id,
              activityType: "MEETING",
              content: "Consultation, package discussion and closing",
              result: "Converted to customer",
              nextFollowUpAt: lead.nextFollowUpAt,
              performedById: assignedUserId,
              contactAt: addDays(baseContactAt, 2),
            },
          ];
        }

        return [
          {
            leadId: targetLead.id,
            activityType: index % 2 === 0 ? "CALL" : "MESSAGE",
            content:
              "Reference follow-up to test lead timeline and latest-contact widgets",
            result: lead.lastContactResult,
            nextFollowUpAt: lead.nextFollowUpAt,
            performedById: assignedUserId,
            contactAt: baseContactAt,
          },
        ];
      }),
    ],
  });

  const contracts = await prisma.contract.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        customerId: customerAnh.id,
        servicePackageId: pt12Package.id,
        saleUserId: userMap.get("sales")!.id,
        trainerId: trainerProfile.id,
        code: "CTR0001",
        contractType: "pt_package",
        packageName: "PT 12 Buoi",
        startDate: new Date("2026-03-19"),
        endDate: new Date("2026-05-19"),
        totalSessions: 14,
        usedSessions: 5,
        remainingSessions: 9,
        bonusSessions: 2,
        unitPrice: decimal(8500000),
        grossAmount: decimal(8500000),
        totalDiscount: decimal(500000),
        totalAmount: decimal(8000000),
        amountPaid: decimal(6500000),
        amountDue: decimal(1500000),
        remainingValue: decimal(5142857),
        paymentStatus: "PARTIAL",
        status: "ACTIVE",
        richNote:
          "<p>PT package with body composition review every 2 weeks.</p>",
        note: "Installment remaining to be collected in April.",
      },
      {
        branchId: hq.id,
        customerId: customerBinh.id,
        servicePackageId: gym3mPackage.id,
        saleUserId: userMap.get("sales")!.id,
        code: "CTR0002",
        contractType: "membership",
        packageName: "Gym 3 Thang",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-05-30"),
        totalSessions: 90,
        usedSessions: 28,
        remainingSessions: 62,
        unitPrice: decimal(3300000),
        grossAmount: decimal(3300000),
        totalAmount: decimal(3300000),
        amountPaid: decimal(3300000),
        amountDue: decimal(0),
        remainingValue: decimal(2273333),
        paymentStatus: "PAID",
        status: "ACTIVE",
        note: "Morning gym package.",
      },
      {
        branchId: east.id,
        customerId: customerHa.id,
        servicePackageId: gym3mPackage.id,
        saleUserId: userMap.get("cskh")!.id,
        code: "CTR0003",
        contractType: "membership",
        packageName: "Gym 3 Thang",
        startDate: new Date("2026-02-15"),
        endDate: new Date("2026-05-15"),
        totalSessions: 90,
        usedSessions: 55,
        remainingSessions: 35,
        unitPrice: decimal(3000000),
        grossAmount: decimal(3000000),
        totalAmount: decimal(3000000),
        amountPaid: decimal(2400000),
        amountDue: decimal(600000),
        remainingValue: decimal(1166667),
        paymentStatus: "PARTIAL",
        status: "ACTIVE",
        note: "Need reminder before renewal.",
      },
      ...referenceMemberProfiles.map((profile) => ({
        branchId: profile.branchId,
        customerId: customerMap.get(profile.customerCode)!.id,
        servicePackageId: profile.servicePackageId,
        saleUserId: profile.assignedUserId,
        trainerId: profile.trainerId,
        code: profile.contractCode,
        contractType: profile.contractType,
        packageName: profile.packageName,
        startDate: profile.startTrainingDate,
        endDate: profile.endTrainingDate,
        totalSessions: profile.totalSessions,
        usedSessions: profile.usedSessions,
        remainingSessions: profile.remainingSessions,
        bonusSessions: profile.bonusSessions,
        unitPrice: decimal(profile.unitPrice),
        grossAmount: decimal(profile.grossAmount),
        totalDiscount: decimal(profile.totalDiscount),
        totalAmount: decimal(profile.totalAmount),
        amountPaid: decimal(profile.amountPaid),
        amountDue: decimal(profile.amountDue),
        remainingValue: decimal(profile.remainingValue),
        paymentStatus: profile.paymentStatus,
        status: profile.status,
        richNote: profile.richNote,
        note: profile.note,
      })),
    ],
  });

  const contractAnh = contracts.find((item) => item.code === "CTR0001")!;
  const contractBinh = contracts.find((item) => item.code === "CTR0002")!;
  const contractHa = contracts.find((item) => item.code === "CTR0003")!;
  const contractMap = new Map(contracts.map((item) => [item.code, item]));

  await prisma.contractItem.createMany({
    data: [
      {
        contractId: contractAnh.id,
        serviceId: ptService.id,
        servicePackageId: pt12Package.id,
        description: "PT 12 + 2 bonus sessions",
        quantity: 1,
        sessionCount: 14,
        unitPrice: decimal(8500000),
        discountAmount: decimal(500000),
        totalAmount: decimal(8000000),
      },
      {
        contractId: contractBinh.id,
        serviceId: gymService.id,
        servicePackageId: gym3mPackage.id,
        description: "Gym 3 months membership",
        quantity: 1,
        sessionCount: 90,
        unitPrice: decimal(3300000),
        totalAmount: decimal(3300000),
      },
      ...referenceMemberProfiles.map((profile) => ({
        contractId: contractMap.get(profile.contractCode)!.id,
        serviceId: profile.serviceId,
        servicePackageId: profile.servicePackageId,
        description: `${profile.packageName} reference line item`,
        quantity: 1,
        sessionCount: profile.totalSessions,
        unitPrice: decimal(profile.unitPrice),
        discountAmount: decimal(profile.totalDiscount),
        totalAmount: decimal(profile.totalAmount),
      })),
    ],
  });

  await prisma.contractHistory.createMany({
    data: [
      {
        contractId: contractAnh.id,
        action: "CREATE",
        note: "Contract created from converted lead",
        afterData: { status: "ACTIVE", amountDue: 1500000 },
        actedById: userMap.get("sales")!.id,
      },
      {
        contractId: contractAnh.id,
        action: "UPDATE_PAYMENT",
        note: "First installment received",
        beforeData: { amountPaid: 0 },
        afterData: { amountPaid: 6500000 },
        actedById: userMap.get("accountant")!.id,
      },
      ...referenceMemberProfiles.flatMap((profile) => [
        {
          contractId: contractMap.get(profile.contractCode)!.id,
          action: "CREATE",
          note: "Reference contract created for seeded comparison data",
          afterData: {
            status: profile.status,
            totalAmount: profile.totalAmount,
            amountDue: profile.amountDue,
          },
          actedById: profile.assignedUserId,
        },
        ...(profile.amountPaid > 0
          ? [
              {
                contractId: contractMap.get(profile.contractCode)!.id,
                action: "UPDATE_PAYMENT",
                note:
                  profile.amountDue === 0
                    ? "Full payment received"
                    : "Partial payment collected",
                beforeData: { amountPaid: 0, paymentStatus: "UNPAID" },
                afterData: {
                  amountPaid: profile.amountPaid,
                  amountDue: profile.amountDue,
                  paymentStatus: profile.paymentStatus,
                },
                actedById:
                  profile.branchId === hq.id
                    ? userMap.get("accountant")!.id
                    : profile.assignedUserId,
              },
            ]
          : []),
      ]),
    ],
  });

  const receipts = await prisma.paymentReceipt.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        customerId: customerAnh.id,
        contractId: contractAnh.id,
        paymentMethodId: bankMethod.id,
        code: "RCP0001",
        receiptDate: new Date("2026-03-19T10:00:00Z"),
        amount: decimal(6500000),
        content: "Thanh toan dot 1 hop dong PT",
        sourceType: "contract",
        collectorId: userMap.get("accountant")!.id,
      },
      {
        branchId: hq.id,
        customerId: customerBinh.id,
        contractId: contractBinh.id,
        paymentMethodId: cashMethod.id,
        code: "RCP0002",
        receiptDate: new Date("2026-03-01T08:00:00Z"),
        amount: decimal(3300000),
        content: "Thanh toan hop dong gym 3 thang",
        sourceType: "contract",
        collectorId: userMap.get("sales")!.id,
      },
      {
        branchId: east.id,
        customerId: customerHa.id,
        contractId: contractHa.id,
        paymentMethodId: bankMethod.id,
        code: "RCP0003",
        receiptDate: new Date("2026-02-15T09:30:00Z"),
        amount: decimal(2400000),
        content: "Thanh toan dot 1 goi tap",
        sourceType: "contract",
        collectorId: userMap.get("cskh")!.id,
      },
      ...referenceMemberProfiles.map((profile, index) => ({
        branchId: profile.branchId,
        customerId: customerMap.get(profile.customerCode)!.id,
        contractId: contractMap.get(profile.contractCode)!.id,
        paymentMethodId: index % 2 === 0 ? bankMethod.id : cashMethod.id,
        code: profile.receiptCode,
        receiptDate: profile.receiptDate,
        amount: decimal(profile.amountPaid),
        content:
          profile.contractType === "pt_package"
            ? `Thanh toan ${profile.packageName}`
            : "Thanh toan goi hoi vien gym",
        sourceType: "contract",
        collectorId:
          profile.branchId === hq.id
            ? userMap.get(index % 3 === 0 ? "accountant" : "sales")!.id
            : userMap.get("cskh")!.id,
      })),
    ],
  });

  const expenses = await prisma.paymentExpense.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        paymentMethodId: cashMethod.id,
        code: "EXP0001",
        expenseDate: new Date("2026-03-20T09:00:00Z"),
        payeeName: "Clean Services Co",
        expenseType: "facility",
        amount: decimal(1800000),
        approverId: userMap.get("manager")!.id,
        createdUserId: userMap.get("accountant")!.id,
        note: "Monthly cleaning service",
      },
      {
        branchId: east.id,
        paymentMethodId: bankMethod.id,
        code: "EXP0002",
        expenseDate: new Date("2026-03-24T05:00:00Z"),
        payeeName: "Marketing Agency",
        expenseType: "marketing",
        amount: decimal(2200000),
        approverId: userMap.get("owner")!.id,
        createdUserId: userMap.get("accountant")!.id,
        note: "Lead ads campaign fee",
      },
      ...Array.from({ length: 18 }, (_, index) => {
        const sequence = index + 3;
        const branch = index % 3 === 0 ? east : hq;
        const expenseType = [
          "facility",
          "marketing",
          "utilities",
          "equipment",
          "office",
          "payroll",
        ][index % 6];
        return {
          branchId: branch.id,
          paymentMethodId: index % 2 === 0 ? bankMethod.id : cashMethod.id,
          code: `EXP${padNumber(sequence)}`,
          expenseDate: withTime(
            addDays(new Date("2026-03-02T00:00:00Z"), index * 2),
            branch.id === hq.id ? 8 : 7,
            index % 2 === 0 ? 15 : 45,
          ),
          payeeName:
            expenseType === "facility"
              ? "Facility Service Vendor"
              : expenseType === "marketing"
                ? "Digital Ads Partner"
                : expenseType === "utilities"
                  ? "Electricity Provider"
                  : expenseType === "equipment"
                    ? "Fitness Equipment Care"
                    : expenseType === "office"
                      ? "Office Supply House"
                      : "Part-time Coach Support",
          expenseType,
          amount: decimal(850000 + index * 175000),
          approverId:
            branch.id === hq.id
              ? userMap.get("manager")!.id
              : userMap.get("owner")!.id,
          createdUserId:
            branch.id === hq.id
              ? userMap.get("accountant")!.id
              : userMap.get("hr")!.id,
          note: "Chi phi van hanh mau de doi chieu bao cao va kiem thu bang du lieu.",
        };
      }),
    ],
  });

  const lockers = await prisma.locker.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        code: "LOCK001",
        name: "Tu A1",
        label: "A1",
        price: decimal(300000),
        status: "RENTED",
      },
      {
        branchId: hq.id,
        code: "LOCK002",
        name: "Tu A2",
        label: "A2",
        price: decimal(300000),
        status: "EMPTY",
      },
      {
        branchId: east.id,
        code: "LOCK003",
        name: "Tu B1",
        label: "B1",
        price: decimal(250000),
        status: "EMPTY",
      },
    ],
  });

  const lockerA1 = lockers.find((item) => item.code === "LOCK001")!;
  const rental = await prisma.lockerRental.create({
    data: {
      branchId: hq.id,
      lockerId: lockerA1.id,
      customerId: customerAnh.id,
      code: "LKR0001",
      startDate: new Date("2026-03-20"),
      endDate: new Date("2026-04-20"),
      depositAmount: decimal(500000),
      processedById: userMap.get("sales")!.id,
      status: "ACTIVE",
      note: "Monthly locker rental",
    },
  });

  await prisma.deposit.create({
    data: {
      branchId: hq.id,
      customerId: customerAnh.id,
      lockerRentalId: rental.id,
      code: "DEP0001",
      itemType: "locker_deposit",
      amount: decimal(500000),
      receivedAt: new Date("2026-03-20T08:00:00Z"),
      processedById: userMap.get("sales")!.id,
      status: "HOLDING",
      note: "Locker deposit active",
    },
  });

  const [supplementCategory] = await prisma.productCategory.createManyAndReturn(
    {
      data: [
        {
          code: "SUPP",
          name: "Supplements",
          description: "Protein and recovery products",
        },
      ],
    },
  );

  const products = await prisma.product.createManyAndReturn({
    data: [
      {
        branchId: hq.id,
        categoryId: supplementCategory.id,
        code: "P001",
        name: "Whey Protein 2kg",
        unit: "box",
        groupName: "Protein",
        purchasePrice: decimal(950000),
        salePrice: decimal(1250000),
        stockQuantity: 18,
        minStockQuantity: 5,
      },
      {
        branchId: hq.id,
        categoryId: supplementCategory.id,
        code: "P002",
        name: "Shaker Bottle",
        unit: "piece",
        groupName: "Accessory",
        purchasePrice: decimal(55000),
        salePrice: decimal(120000),
        stockQuantity: 42,
        minStockQuantity: 10,
      },
    ],
  });
  const productMap = new Map(
    products.map((product) => [product.code, product]),
  );

  await prisma.paymentReceipt.create({
    data: {
      branchId: hq.id,
      customerId: customerBinh.id,
      paymentMethodId: cashMethod.id,
      code: "SALE0001",
      receiptDate: new Date("2026-03-26T11:15:00Z"),
      amount: decimal(1490000),
      content: "Ban hang whey + binh lac Pro Shop",
      sourceType: "PRO_SHOP_SALE",
      lineItems: [
        {
          productId: productMap.get("P001")!.id,
          productCode: "P001",
          productName: "Whey Protein 2kg",
          unit: "box",
          quantity: 1,
          unitPrice: "1250000",
          totalPrice: "1250000",
        },
        {
          productId: productMap.get("P002")!.id,
          productCode: "P002",
          productName: "Shaker Bottle",
          unit: "piece",
          quantity: 2,
          unitPrice: "120000",
          totalPrice: "240000",
          note: "Combo sale counter",
        },
      ],
      collectorId: userMap.get("sales")!.id,
      note: "Khach mua tai quay sau buoi tap.",
    },
  });

  await prisma.paymentExpense.create({
    data: {
      branchId: hq.id,
      paymentMethodId: cashMethod.id,
      code: "RET0001",
      expenseDate: new Date("2026-03-29T09:45:00Z"),
      payeeName: customerBinh.fullName,
      expenseType: "PRO_SHOP_RETURN",
      amount: decimal(120000),
      lineItems: [
        {
          productId: productMap.get("P002")!.id,
          productCode: "P002",
          productName: "Shaker Bottle",
          unit: "piece",
          quantity: 1,
          unitPrice: "120000",
          totalPrice: "120000",
          note: "Doi size / mau sac",
        },
      ],
      approverId: userMap.get("manager")!.id,
      createdUserId: userMap.get("sales")!.id,
      note: "Hoan tien mot phan cho khach do tra lai 1 binh lac.",
    },
  });

  await prisma.product.update({
    where: { id: productMap.get("P001")!.id },
    data: { stockQuantity: 17 },
  });

  await prisma.product.update({
    where: { id: productMap.get("P002")!.id },
    data: { stockQuantity: 41 },
  });

  const supplier = await prisma.supplier.create({
    data: {
      branchId: hq.id,
      code: "SUP0001",
      name: "Healthy Nutrition Co",
      contactName: "Pham Linh",
      phone: "0902000001",
      email: "sales@healthynutrition.local",
      address: "88 Dien Bien Phu, Binh Thanh",
      note: "Primary supplement supplier",
    },
  });

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      branchId: hq.id,
      supplierId: supplier.id,
      code: "PO0001",
      orderDate: new Date("2026-03-10"),
      expectedDate: new Date("2026-03-12"),
      totalAmount: decimal(7510000),
      status: "COMPLETED",
      createdUserId: userMap.get("manager")!.id,
      note: "Restock supplements for Q2 launch",
    },
  });

  await prisma.purchaseOrderItem.createMany({
    data: [
      {
        purchaseOrderId: purchaseOrder.id,
        productId: products.find((item) => item.code === "P001")!.id,
        quantity: 6,
        unitPrice: decimal(950000),
        totalPrice: decimal(5700000),
      },
      {
        purchaseOrderId: purchaseOrder.id,
        productId: products.find((item) => item.code === "P002")!.id,
        quantity: 33,
        unitPrice: decimal(55000),
        totalPrice: decimal(1815000),
      },
    ],
  });

  const attachment = await prisma.attachment.create({
    data: {
      branchId: hq.id,
      entityType: "customer",
      entityId: customerAnh.id,
      fileName: "customer-anh-contract.pdf",
      fileUrl: "http://localhost:9000/fitness-files/customer-anh-contract.pdf",
      mimeType: "application/pdf",
      size: 182944,
      bucket: "fitness-files",
      objectKey: "customers/customer-anh-contract.pdf",
      uploadedById: userMap.get("sales")!.id,
    },
  });

  await prisma.customerFile.create({
    data: {
      customerId: customerAnh.id,
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      size: attachment.size,
      note: "Signed PT contract",
    },
  });

  const session1 = await prisma.trainingSession.create({
    data: {
      branchId: hq.id,
      contractId: contractAnh.id,
      customerId: customerAnh.id,
      trainerId: trainerProfile.id,
      code: "TS0001",
      scheduledAt: new Date("2026-03-21T10:00:00Z"),
      durationMinutes: 60,
      status: "COMPLETED",
      checkInAt: new Date("2026-03-21T10:02:00Z"),
      checkOutAt: new Date("2026-03-21T11:00:00Z"),
      consumedSessions: 1,
      outcome: "Completed lower body workout",
      note: "Good adherence to plan",
    },
  });

  await prisma.trainingAttendance.create({
    data: {
      sessionId: session1.id,
      customerId: customerAnh.id,
      status: "PRESENT",
      checkInAt: new Date("2026-03-21T10:02:00Z"),
      consumedSessions: 1,
      note: "On time",
    },
  });

  await prisma.attachment.create({
    data: {
      branchId: hq.id,
      entityType: "training_session",
      entityId: session1.id,
      fileName: "ts0001-training-note.pdf",
      fileUrl: "http://localhost:9000/fitness-files/ts0001-training-note.pdf",
      mimeType: "application/pdf",
      size: 96412,
      bucket: "fitness-files",
      objectKey: "training-sessions/ts0001-training-note.pdf",
      uploadedById: userMap.get("sales")!.id,
    },
  });

  const generatedTrainingSessionPlans = referenceMemberProfiles
    .filter(
      (profile) => profile.contractType === "pt_package" && profile.trainerId,
    )
    .flatMap((profile, index) => {
      const firstSessionAt = withTime(
        addDays(profile.startTrainingDate, 5 + (index % 4)),
        profile.branchId === hq.id ? 10 : 8,
        0,
      );
      const secondSessionAt = withTime(
        addDays(profile.startTrainingDate, 12 + (index % 5)),
        profile.branchId === hq.id ? 11 : 9,
        30,
      );
      const secondStatus =
        index % 5 === 0
          ? "MISSED"
          : index % 4 === 0
            ? "SCHEDULED"
            : "COMPLETED";

      return [
        {
          code: `TS${padNumber(index * 2 + 2)}`,
          branchId: profile.branchId,
          contractCode: profile.contractCode,
          customerCode: profile.customerCode,
          trainerId: profile.trainerId,
          scheduledAt: firstSessionAt,
          durationMinutes: 60,
          status: "COMPLETED",
          checkInAt: addMinutes(firstSessionAt, 2),
          checkOutAt: addMinutes(firstSessionAt, 62),
          consumedSessions: 1,
          outcome: "Completed seeded PT session",
          note: "Reference session for PT attendance and package progress reports.",
          attendanceStatus: "PRESENT" as const,
          attendanceNote: "Completed as planned",
        },
        {
          code: `TS${padNumber(index * 2 + 3)}`,
          branchId: profile.branchId,
          contractCode: profile.contractCode,
          customerCode: profile.customerCode,
          trainerId: profile.trainerId,
          scheduledAt: secondSessionAt,
          durationMinutes: 60,
          status: secondStatus,
          checkInAt:
            secondStatus === "COMPLETED"
              ? addMinutes(secondSessionAt, 3)
              : undefined,
          checkOutAt:
            secondStatus === "COMPLETED"
              ? addMinutes(secondSessionAt, 63)
              : undefined,
          consumedSessions: secondStatus === "MISSED" ? 0 : 1,
          outcome:
            secondStatus === "COMPLETED"
              ? "Follow-up PT session completed"
              : undefined,
          note:
            secondStatus === "MISSED"
              ? "Member missed seeded PT session."
              : secondStatus === "SCHEDULED"
                ? "Upcoming PT session for seeded dashboard data."
                : "Second seeded PT session completed.",
          attendanceStatus:
            secondStatus === "MISSED"
              ? ("ABSENT" as const)
              : secondStatus === "COMPLETED"
                ? ("PRESENT" as const)
                : undefined,
          attendanceNote:
            secondStatus === "MISSED"
              ? "Absent in seeded PT session"
              : secondStatus === "COMPLETED"
                ? "Completed follow-up"
                : undefined,
        },
      ];
    });

  const generatedTrainingSessions =
    await prisma.trainingSession.createManyAndReturn({
      data: generatedTrainingSessionPlans.map((plan) => ({
        branchId: plan.branchId,
        contractId: contractMap.get(plan.contractCode)!.id,
        customerId: customerMap.get(plan.customerCode)!.id,
        trainerId: plan.trainerId,
        code: plan.code,
        scheduledAt: plan.scheduledAt,
        durationMinutes: plan.durationMinutes,
        status: plan.status,
        checkInAt: plan.checkInAt,
        checkOutAt: plan.checkOutAt,
        consumedSessions: plan.consumedSessions,
        outcome: plan.outcome,
        note: plan.note,
      })),
    });
  const trainingSessionMap = new Map(
    [session1, ...generatedTrainingSessions].map((session) => [
      session.code,
      session,
    ]),
  );

  await prisma.trainingAttendance.createMany({
    data: generatedTrainingSessionPlans
      .filter((plan) => plan.attendanceStatus)
      .map((plan) => ({
        sessionId: trainingSessionMap.get(plan.code)!.id,
        customerId: customerMap.get(plan.customerCode)!.id,
        status: plan.attendanceStatus!,
        checkInAt:
          plan.attendanceStatus === "PRESENT" ? plan.checkInAt : undefined,
        consumedSessions: plan.attendanceStatus === "PRESENT" ? 1 : 0,
        note: plan.attendanceNote,
      })),
  });

  const attendanceMachines = await prisma.attendanceMachine.createManyAndReturn(
    {
      data: [
        {
          branchId: hq.id,
          code: "ATT-HQ-01",
          name: "Gate Reader HQ 01",
          connectionPort: "4370",
          host: "192.168.1.50",
          password: "123456",
          syncEnabled: true,
          connectionStatus: "CONNECTED",
          lastSyncedAt: new Date("2026-04-01T00:30:00Z"),
        },
        {
          branchId: east.id,
          code: "ATT-EAST-01",
          name: "Gate Reader East 01",
          connectionPort: "4370",
          host: "192.168.2.60",
          password: "123456",
          syncEnabled: true,
          connectionStatus: "CONNECTED",
          lastSyncedAt: new Date("2026-04-01T00:45:00Z"),
        },
      ],
    },
  );

  const machineMap = new Map(
    attendanceMachines.map((machine) => [machine.code, machine]),
  );
  const hqMachine = machineMap.get("ATT-HQ-01")!;
  const eastMachine = machineMap.get("ATT-EAST-01")!;

  const makeStaffAttendanceEvents = ({
    username,
    branchId,
    machineId,
    date,
    checkIn,
    checkOut,
    verificationMethod = "FINGERPRINT",
    source = "MACHINE",
    note,
  }: {
    username: string;
    branchId: string;
    machineId?: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    verificationMethod?: "FINGERPRINT" | "FACE" | "CARD" | "MOBILE" | "MANUAL";
    source?: "MACHINE" | "MANUAL" | "IMPORT";
    note?: string;
  }) => {
    const user = userMap.get(username)!;
    const rawCode = user.username.toUpperCase();

    return [
      ...(checkIn
        ? [
            {
              branchId,
              userId: user.id,
              attendanceMachineId: machineId,
              eventAt: new Date(`${date}T${checkIn}:00+07:00`),
              eventType: "CHECK_IN" as const,
              verificationMethod,
              source,
              rawCode,
              note,
            },
          ]
        : []),
      ...(checkOut
        ? [
            {
              branchId,
              userId: user.id,
              attendanceMachineId: machineId,
              eventAt: new Date(`${date}T${checkOut}:00+07:00`),
              eventType: "CHECK_OUT" as const,
              verificationMethod,
              source,
              rawCode,
              note,
            },
          ]
        : []),
    ];
  };

  await prisma.staffAttendanceEvent.createMany({
    data: [
      ...makeStaffAttendanceEvents({
        username: "manager",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-27",
        checkIn: "07:58",
        checkOut: "17:45",
      }),
      ...makeStaffAttendanceEvents({
        username: "manager",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-28",
        checkIn: "08:12",
        checkOut: "17:36",
      }),
      ...makeStaffAttendanceEvents({
        username: "manager",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-30",
        checkIn: "07:59",
        checkOut: "17:31",
      }),
      ...makeStaffAttendanceEvents({
        username: "manager",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-31",
        checkIn: "08:05",
        note: "Missing checkout event after end-of-day meeting.",
      }),
      ...makeStaffAttendanceEvents({
        username: "sales",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-27",
        checkIn: "08:18",
        checkOut: "18:02",
        verificationMethod: "CARD",
      }),
      ...makeStaffAttendanceEvents({
        username: "sales",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-28",
        checkIn: "08:03",
        checkOut: "17:28",
        verificationMethod: "CARD",
      }),
      ...makeStaffAttendanceEvents({
        username: "sales",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-31",
        checkIn: "08:00",
        checkOut: "17:45",
        verificationMethod: "CARD",
      }),
      ...makeStaffAttendanceEvents({
        username: "sales",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-04-01",
        checkIn: "08:07",
        checkOut: "17:20",
        verificationMethod: "CARD",
      }),
      ...makeStaffAttendanceEvents({
        username: "accountant",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-27",
        checkIn: "07:52",
        checkOut: "17:32",
      }),
      ...makeStaffAttendanceEvents({
        username: "accountant",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-30",
        checkIn: "08:04",
        checkOut: "17:50",
      }),
      ...makeStaffAttendanceEvents({
        username: "accountant",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-31",
        checkIn: "08:00",
        checkOut: "17:34",
      }),
      ...makeStaffAttendanceEvents({
        username: "accountant",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-04-01",
        checkIn: "08:26",
        checkOut: "17:42",
      }),
      ...makeStaffAttendanceEvents({
        username: "trainer",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-27",
        checkIn: "05:55",
        checkOut: "14:08",
        verificationMethod: "FACE",
      }),
      ...makeStaffAttendanceEvents({
        username: "trainer",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-28",
        checkIn: "06:10",
        checkOut: "13:56",
        verificationMethod: "FACE",
      }),
      ...makeStaffAttendanceEvents({
        username: "trainer",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-30",
        checkIn: "05:50",
        checkOut: "14:20",
        verificationMethod: "FACE",
      }),
      ...makeStaffAttendanceEvents({
        username: "trainer",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-04-01",
        checkIn: "06:02",
        checkOut: "14:18",
        verificationMethod: "FACE",
      }),
      ...makeStaffAttendanceEvents({
        username: "hr",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-27",
        checkIn: "08:00",
        checkOut: "17:55",
      }),
      ...makeStaffAttendanceEvents({
        username: "hr",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-28",
        checkIn: "08:09",
        checkOut: "17:31",
      }),
      ...makeStaffAttendanceEvents({
        username: "hr",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-30",
        checkIn: "07:57",
        checkOut: "17:29",
      }),
      ...makeStaffAttendanceEvents({
        username: "hr",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-03-31",
        checkIn: "08:03",
        checkOut: "17:37",
      }),
      ...makeStaffAttendanceEvents({
        username: "hr",
        branchId: hq.id,
        machineId: hqMachine.id,
        date: "2026-04-01",
        checkIn: "08:01",
        checkOut: "17:40",
      }),
      ...makeStaffAttendanceEvents({
        username: "cskh",
        branchId: east.id,
        machineId: eastMachine.id,
        date: "2026-03-27",
        checkIn: "08:55",
        checkOut: "18:12",
        verificationMethod: "MOBILE",
      }),
      ...makeStaffAttendanceEvents({
        username: "cskh",
        branchId: east.id,
        machineId: eastMachine.id,
        date: "2026-03-28",
        checkIn: "09:14",
        checkOut: "18:05",
        verificationMethod: "MOBILE",
      }),
      ...makeStaffAttendanceEvents({
        username: "cskh",
        branchId: east.id,
        machineId: eastMachine.id,
        date: "2026-03-30",
        checkIn: "09:02",
        checkOut: "18:10",
        verificationMethod: "MOBILE",
      }),
      ...makeStaffAttendanceEvents({
        username: "cskh",
        branchId: east.id,
        machineId: eastMachine.id,
        date: "2026-03-31",
        checkIn: "08:58",
        verificationMethod: "MOBILE",
        note: "Checkout missing due to mobile sync timeout.",
      }),
    ],
  });

  await prisma.smsConfig.create({
    data: {
      provider: "Twilio",
      apiUrl: "https://api.twilio.local",
      apiKey: "sms-demo-key",
      senderName: "FITFLOW",
      maxPerDay: 500,
      templateOtp: "Ma OTP cua ban la {{otp}}",
      templateReminder: "Ban co lich tap vao {{time}} tai {{branch}}",
      templateBirthday: "Chuc mung sinh nhat {{customer_name}} tu FitFlow",
      isActive: true,
    },
  });

  await prisma.emailConfig.create({
    data: {
      provider: "SMTP",
      host: "mail.fitflow.local",
      port: 587,
      username: "no-reply@fitflow.local",
      password: "secret",
      encryption: "tls",
      fromName: "FitFlow Enterprise",
      fromEmail: "no-reply@fitflow.local",
      maxPerDay: 1000,
      templateBirthday: "Happy birthday {{customer_name}}",
      templateOtp: "OTP {{otp}} is valid for 5 minutes.",
      isActive: true,
    },
  });

  await prisma.zaloConfig.create({
    data: {
      oaName: "FitFlow Official Account",
      oaId: "fitflow-oa-demo",
      appId: "fitflow-zalo-app",
      appSecret: "zalo-secret",
      token: "zalo-token",
      refreshToken: "zalo-refresh",
      maxPerDay: 500,
      templateBirthday: "Zalo birthday template",
      templateReminder: "Zalo session reminder",
      isActive: true,
    },
  });

  await prisma.birthdayTemplate.create({
    data: {
      name: "Birthday SMS Default",
      title: "Happy birthday",
      content:
        "Chuc mung sinh nhat {{customer_name}}, chuc ban suc khoe va nhieu nang luong tap luyen.",
      targetType: "customer",
      remindDays: 0,
      channel: "sms",
      isActive: true,
    },
  });

  await prisma.appSetting.createMany({
    data: [
      {
        group: "general",
        key: "system_profile",
        value: {
          appName: "FitFlow Enterprise",
          timezone: "Asia/Bangkok",
          currency: "VND",
          dateFormat: "DD/MM/YYYY",
          codeGeneration: true,
          uploadLimitMb: 10,
          memberPresenceOvernightGraceHours: 6,
        },
      },
      {
        group: "auth",
        key: "otp",
        value: {
          enabled: false,
          channel: "ZALO",
          apiUrl: "https://business.openapi.zalo.me/message/template",
          otpTemplateId: "",
          otpTemplateDataKey: "otp",
          otpPhoneOverride: "",
          codeLength: 6,
          ttlMinutes: 5,
          resendCooldownSeconds: 60,
          maxRetry: 5,
        },
      },
      {
        branchId: hq.id,
        group: "branch",
        key: "dashboard_targets",
        value: {
          dailyRevenueGoal: 25000000,
          monthlyRevenueGoal: 550000000,
          newLeadGoal: 40,
        },
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        branchId: hq.id,
        userId: userMap.get("manager")!.id,
        title: "3 hop dong sap het han",
        content: "Can goi tu van gia han cho khach trong 7 ngay toi.",
        type: "WARNING",
        actionUrl: "/contracts?status=ACTIVE&expiring=true",
      },
      {
        branchId: east.id,
        userId: userMap.get("cskh")!.id,
        title: "Lead moi can cham soc",
        content: "Lead Le Minh Chau can follow-up truoc 15:00.",
        type: "INFO",
        actionUrl: "/leads",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: userMap.get("admin")!.id,
        module: "auth",
        action: "LOGIN",
        entityType: "user",
        entityId: userMap.get("admin")!.id,
        ipAddress: "127.0.0.1",
        userAgent: "seed-script",
        metadata: { source: "seed" },
      },
      {
        userId: userMap.get("sales")!.id,
        branchId: hq.id,
        module: "contracts",
        action: "CREATE",
        entityType: "contract",
        entityId: contractAnh.id,
        afterData: {
          code: contractAnh.code,
          amountDue: contractAnh.amountDue.toString(),
        },
      },
      {
        userId: userMap.get("accountant")!.id,
        branchId: hq.id,
        module: "receipts",
        action: "EXPORT",
        entityType: "report",
        entityId: "payment-report",
        metadata: { format: "xlsx" },
      },
    ],
  });

  console.log(
    `Seed completed: ${users.length} users, ${customers.length} customers, ${leads.length} leads, ${contracts.length} contracts, ${receipts.length} receipts.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
