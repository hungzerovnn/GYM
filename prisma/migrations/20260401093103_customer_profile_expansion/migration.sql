-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "cardCovid" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "customerCardNumber" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "endTrainingDate" TIMESTAMP(3),
ADD COLUMN     "fingerprintCode" TEXT,
ADD COLUMN     "identityIssueDate" TIMESTAMP(3),
ADD COLUMN     "identityIssuePlace" TEXT,
ADD COLUMN     "otherInfo" TEXT,
ADD COLUMN     "phoneSecondary" TEXT,
ADD COLUMN     "phoneTertiary" TEXT,
ADD COLUMN     "profileCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "registrationDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "serviceNote" TEXT,
ADD COLUMN     "startTrainingDate" TIMESTAMP(3),
ADD COLUMN     "ward" TEXT;

-- CreateIndex
CREATE INDEX "customers_assignedToId_idx" ON "customers"("assignedToId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
