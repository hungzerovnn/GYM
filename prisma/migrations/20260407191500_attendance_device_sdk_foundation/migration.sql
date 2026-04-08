-- CreateEnum
CREATE TYPE "AttendanceMachineVendor" AS ENUM (
    'GENERIC',
    'ZKTECO',
    'HIKVISION',
    'SUPREMA',
    'ANVIZ',
    'RONALD_JACK'
);

-- CreateEnum
CREATE TYPE "AttendanceMachineType" AS ENUM (
    'FINGERPRINT',
    'FACE',
    'CARD',
    'HYBRID'
);

-- CreateEnum
CREATE TYPE "AttendanceMachineProtocol" AS ENUM (
    'GENERIC_EXPORT',
    'CSV_IMPORT',
    'ZK_PULL_TCP',
    'ZK_ADMS_PUSH',
    'HIKVISION_ISAPI',
    'SUPREMA_BIOSTAR',
    'GENERIC_HTTP'
);

-- CreateEnum
CREATE TYPE "AttendancePersonType" AS ENUM (
    'STAFF',
    'CUSTOMER'
);

-- CreateEnum
CREATE TYPE "AttendanceSyncStatus" AS ENUM (
    'PENDING',
    'SYNCED',
    'ERROR',
    'DISABLED'
);

-- CreateEnum
CREATE TYPE "AttendanceEnrollmentType" AS ENUM (
    'FACE',
    'CARD',
    'FINGERPRINT'
);

-- CreateEnum
CREATE TYPE "AttendanceEnrollmentStatus" AS ENUM (
    'PENDING_CAPTURE',
    'CAPTURED',
    'UPLOADED_TO_MACHINE',
    'DOWNLOADED_FROM_MACHINE',
    'CONFIRMED',
    'FAILED'
);

-- CreateEnum
CREATE TYPE "AttendanceBiometricAssetType" AS ENUM (
    'FACE_IMAGE',
    'FACE_TEMPLATE',
    'FINGERPRINT_TEMPLATE',
    'CARD_METADATA'
);

-- CreateEnum
CREATE TYPE "AttendanceStorageProvider" AS ENUM (
    'R2',
    'MINIO',
    'LOCAL',
    'REMOTE_DEVICE'
);

-- CreateEnum
CREATE TYPE "AttendanceBiometricAssetSource" AS ENUM (
    'DEVICE',
    'UPLOAD',
    'IMPORT',
    'SDK_EXPORT'
);

-- AlterTable
ALTER TABLE "attendance_machines"
ADD COLUMN "vendor" "AttendanceMachineVendor" NOT NULL DEFAULT 'GENERIC',
ADD COLUMN "machineType" "AttendanceMachineType" NOT NULL DEFAULT 'FINGERPRINT',
ADD COLUMN "protocol" "AttendanceMachineProtocol" NOT NULL DEFAULT 'GENERIC_EXPORT',
ADD COLUMN "model" TEXT,
ADD COLUMN "deviceIdentifier" TEXT,
ADD COLUMN "commKey" TEXT,
ADD COLUMN "username" TEXT,
ADD COLUMN "apiKey" TEXT,
ADD COLUMN "webhookSecret" TEXT,
ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
ADD COLUMN "pollingIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN "supportsFaceImage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "supportsFaceTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "supportsCardEnrollment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "supportsFingerprintTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "supportsWebhook" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN "lastErrorCode" TEXT,
ADD COLUMN "lastErrorMessage" TEXT,
ADD COLUMN "lastLogCursor" TEXT,
ADD COLUMN "lastUserSyncCursor" TEXT;

-- CreateTable
CREATE TABLE "attendance_machine_person_maps" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "attendanceMachineId" TEXT NOT NULL,
    "personType" "AttendancePersonType" NOT NULL,
    "personId" TEXT NOT NULL,
    "appAttendanceCode" TEXT,
    "machineUserId" TEXT,
    "machineCode" TEXT,
    "cardCode" TEXT,
    "faceProfileId" TEXT,
    "fingerprintProfileId" TEXT,
    "syncStatus" "AttendanceSyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_machine_person_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_enrollments" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "attendanceMachineId" TEXT NOT NULL,
    "personMapId" TEXT,
    "personType" "AttendancePersonType" NOT NULL,
    "personId" TEXT NOT NULL,
    "enrollmentType" "AttendanceEnrollmentType" NOT NULL,
    "status" "AttendanceEnrollmentStatus" NOT NULL DEFAULT 'PENDING_CAPTURE',
    "capturedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "machineUserId" TEXT,
    "qualityScore" DECIMAL(5,2),
    "templateVersion" TEXT,
    "note" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_biometric_assets" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "attendanceMachineId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "personType" "AttendancePersonType" NOT NULL,
    "personId" TEXT NOT NULL,
    "assetType" "AttendanceBiometricAssetType" NOT NULL,
    "storageProvider" "AttendanceStorageProvider" NOT NULL,
    "source" "AttendanceBiometricAssetSource" NOT NULL DEFAULT 'UPLOAD',
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_biometric_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_machine_person_maps_attendanceMachineId_personType_personId_key"
ON "attendance_machine_person_maps"("attendanceMachineId", "personType", "personId");

-- CreateIndex
CREATE INDEX "attendance_machine_person_maps_branchId_attendanceMachineId_idx"
ON "attendance_machine_person_maps"("branchId", "attendanceMachineId");

-- CreateIndex
CREATE INDEX "attendance_machine_person_maps_personType_personId_idx"
ON "attendance_machine_person_maps"("personType", "personId");

-- CreateIndex
CREATE INDEX "attendance_machine_person_maps_attendanceMachineId_machineUserId_idx"
ON "attendance_machine_person_maps"("attendanceMachineId", "machineUserId");

-- CreateIndex
CREATE INDEX "attendance_enrollments_branchId_attendanceMachineId_idx"
ON "attendance_enrollments"("branchId", "attendanceMachineId");

-- CreateIndex
CREATE INDEX "attendance_enrollments_personType_personId_idx"
ON "attendance_enrollments"("personType", "personId");

-- CreateIndex
CREATE INDEX "attendance_enrollments_attendanceMachineId_status_idx"
ON "attendance_enrollments"("attendanceMachineId", "status");

-- CreateIndex
CREATE INDEX "attendance_enrollments_personMapId_idx"
ON "attendance_enrollments"("personMapId");

-- CreateIndex
CREATE INDEX "attendance_biometric_assets_branchId_attendanceMachineId_assetType_idx"
ON "attendance_biometric_assets"("branchId", "attendanceMachineId", "assetType");

-- CreateIndex
CREATE INDEX "attendance_biometric_assets_personType_personId_idx"
ON "attendance_biometric_assets"("personType", "personId");

-- CreateIndex
CREATE INDEX "attendance_biometric_assets_enrollmentId_idx"
ON "attendance_biometric_assets"("enrollmentId");

-- CreateIndex
CREATE INDEX "attendance_biometric_assets_sha256_idx"
ON "attendance_biometric_assets"("sha256");

-- AddForeignKey
ALTER TABLE "attendance_machine_person_maps"
ADD CONSTRAINT "attendance_machine_person_maps_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_machine_person_maps"
ADD CONSTRAINT "attendance_machine_person_maps_attendanceMachineId_fkey"
FOREIGN KEY ("attendanceMachineId") REFERENCES "attendance_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_enrollments"
ADD CONSTRAINT "attendance_enrollments_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_enrollments"
ADD CONSTRAINT "attendance_enrollments_attendanceMachineId_fkey"
FOREIGN KEY ("attendanceMachineId") REFERENCES "attendance_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_enrollments"
ADD CONSTRAINT "attendance_enrollments_personMapId_fkey"
FOREIGN KEY ("personMapId") REFERENCES "attendance_machine_person_maps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_biometric_assets"
ADD CONSTRAINT "attendance_biometric_assets_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_biometric_assets"
ADD CONSTRAINT "attendance_biometric_assets_attendanceMachineId_fkey"
FOREIGN KEY ("attendanceMachineId") REFERENCES "attendance_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_biometric_assets"
ADD CONSTRAINT "attendance_biometric_assets_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "attendance_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
