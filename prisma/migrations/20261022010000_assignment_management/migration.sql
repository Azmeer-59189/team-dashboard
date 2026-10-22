BEGIN;
ALTER TABLE "Task" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" TEXT,
ADD COLUMN "cancelledByName" TEXT,
ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_cancellation_evidence" CHECK (
  "cancelledAt" IS NULL OR ("status" = 'PENDING' AND "reviewStatus" = 'DRAFT'
    AND "cancelledById" IS NOT NULL AND "cancellationReason" IS NOT NULL
    AND length(trim("cancellationReason")) > 0)
);
CREATE INDEX "Task_cancelledAt_idx" ON "Task"("cancelledAt");
COMMIT;
