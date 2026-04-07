-- CreateTable
CREATE TABLE "login_otp_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "channel" TEXT NOT NULL DEFAULT 'ZALO',
    "deliveryTarget" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "requestIp" TEXT,
    "userAgent" TEXT,
    "providerResponse" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_otp_challenges_userId_createdAt_idx" ON "login_otp_challenges"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "login_otp_challenges_deliveryTarget_createdAt_idx" ON "login_otp_challenges"("deliveryTarget", "createdAt");

-- CreateIndex
CREATE INDEX "login_otp_challenges_expiresAt_idx" ON "login_otp_challenges"("expiresAt");

-- CreateIndex
CREATE INDEX "login_otp_challenges_consumedAt_idx" ON "login_otp_challenges"("consumedAt");

-- AddForeignKey
ALTER TABLE "login_otp_challenges" ADD CONSTRAINT "login_otp_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_otp_challenges" ADD CONSTRAINT "login_otp_challenges_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
