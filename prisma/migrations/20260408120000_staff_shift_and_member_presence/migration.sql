DO $$
BEGIN
  CREATE TYPE "MemberPresenceStatus" AS ENUM ('ACTIVE', 'OFF', 'AUTO_CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MemberPresenceSource" AS ENUM ('MANUAL', 'MACHINE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "staff_shifts" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "workHours" DOUBLE PRECISION,
  "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  "earlyLeaveToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  "overtimeAfterMinutes" INTEGER NOT NULL DEFAULT 0,
  "mealAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "nightAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isOvernight" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_shift_assignments" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "isUnlimitedRotation" BOOLEAN NOT NULL DEFAULT false,
  "includeAllShifts" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "staff_shift_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_shift_assignment_shifts" (
  "assignmentId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "staff_shift_assignment_shifts_pkey" PRIMARY KEY ("assignmentId", "shiftId")
);

CREATE TABLE "member_presence_sessions" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "attendanceMachineId" TEXT,
  "checkInAt" TIMESTAMP(3) NOT NULL,
  "checkOutAt" TIMESTAMP(3),
  "autoClosedAt" TIMESTAMP(3),
  "graceHours" INTEGER NOT NULL DEFAULT 6,
  "status" "MemberPresenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "MemberPresenceSource" NOT NULL DEFAULT 'MANUAL',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "member_presence_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_shifts_branchId_code_key" ON "staff_shifts"("branchId", "code");
CREATE INDEX "staff_shifts_branchId_deletedAt_idx" ON "staff_shifts"("branchId", "deletedAt");

CREATE UNIQUE INDEX "staff_shift_assignments_branchId_code_key" ON "staff_shift_assignments"("branchId", "code");
CREATE INDEX "staff_shift_assignments_branchId_userId_startDate_deletedAt_idx" ON "staff_shift_assignments"("branchId", "userId", "startDate", "deletedAt");
CREATE INDEX "staff_shift_assignments_userId_deletedAt_idx" ON "staff_shift_assignments"("userId", "deletedAt");

CREATE UNIQUE INDEX "staff_shift_assignment_shifts_assignmentId_sequence_key" ON "staff_shift_assignment_shifts"("assignmentId", "sequence");
CREATE INDEX "staff_shift_assignment_shifts_shiftId_idx" ON "staff_shift_assignment_shifts"("shiftId");

CREATE INDEX "member_presence_sessions_branchId_status_checkInAt_idx" ON "member_presence_sessions"("branchId", "status", "checkInAt");
CREATE INDEX "member_presence_sessions_customerId_checkInAt_idx" ON "member_presence_sessions"("customerId", "checkInAt");
CREATE INDEX "member_presence_sessions_attendanceMachineId_checkInAt_idx" ON "member_presence_sessions"("attendanceMachineId", "checkInAt");

ALTER TABLE "staff_shifts"
ADD CONSTRAINT "staff_shifts_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_shift_assignments"
ADD CONSTRAINT "staff_shift_assignments_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_shift_assignments"
ADD CONSTRAINT "staff_shift_assignments_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_shift_assignment_shifts"
ADD CONSTRAINT "staff_shift_assignment_shifts_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "staff_shift_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_shift_assignment_shifts"
ADD CONSTRAINT "staff_shift_assignment_shifts_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "staff_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_presence_sessions"
ADD CONSTRAINT "member_presence_sessions_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_presence_sessions"
ADD CONSTRAINT "member_presence_sessions_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_presence_sessions"
ADD CONSTRAINT "member_presence_sessions_attendanceMachineId_fkey"
FOREIGN KEY ("attendanceMachineId") REFERENCES "attendance_machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
