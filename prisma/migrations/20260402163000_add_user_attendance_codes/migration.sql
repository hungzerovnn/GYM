ALTER TABLE "users"
ADD COLUMN "employeeCode" TEXT,
ADD COLUMN "attendanceCode" TEXT;

UPDATE "users"
SET "employeeCode" = UPPER("username")
WHERE "employeeCode" IS NULL;

UPDATE "users"
SET "attendanceCode" = COALESCE("employeeCode", UPPER("username"))
WHERE "attendanceCode" IS NULL;

CREATE UNIQUE INDEX "users_employeeCode_key" ON "users"("employeeCode");
CREATE UNIQUE INDEX "users_attendanceCode_key" ON "users"("attendanceCode");

CREATE INDEX "users_employeeCode_idx" ON "users"("employeeCode");
CREATE INDEX "users_attendanceCode_idx" ON "users"("attendanceCode");
