ALTER TABLE "payments_receipt"
ADD COLUMN "lineItems" JSONB;

ALTER TABLE "payments_expense"
ADD COLUMN "lineItems" JSONB;
