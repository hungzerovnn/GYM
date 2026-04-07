-- CreateEnum
CREATE TYPE "StaffAttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "StaffAttendanceSource" AS ENUM ('MACHINE', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "StaffAttendanceMethod" AS ENUM ('FINGERPRINT', 'FACE', 'CARD', 'MOBILE', 'MANUAL');

-- CreateTable
CREATE TABLE "staff_attendance_events" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceMachineId" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "eventType" "StaffAttendanceEventType" NOT NULL,
    "verificationMethod" "StaffAttendanceMethod" NOT NULL DEFAULT 'FINGERPRINT',
    "source" "StaffAttendanceSource" NOT NULL DEFAULT 'MACHINE',
    "rawCode" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_attendance_events_branchId_eventAt_idx" ON "staff_attendance_events"("branchId", "eventAt");

-- CreateIndex
CREATE INDEX "staff_attendance_events_userId_eventAt_idx" ON "staff_attendance_events"("userId", "eventAt");

-- CreateIndex
CREATE INDEX "staff_attendance_events_attendanceMachineId_eventAt_idx" ON "staff_attendance_events"("attendanceMachineId", "eventAt");

-- AddForeignKey
ALTER TABLE "staff_attendance_events" ADD CONSTRAINT "staff_attendance_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_events" ADD CONSTRAINT "staff_attendance_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_events" ADD CONSTRAINT "staff_attendance_events_attendanceMachineId_fkey" FOREIGN KEY ("attendanceMachineId") REFERENCES "attendance_machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
