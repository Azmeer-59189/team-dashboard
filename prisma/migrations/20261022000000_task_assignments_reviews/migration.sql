BEGIN;
-- CreateEnum
CREATE TYPE "TaskReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "assignedByName" TEXT,
ADD COLUMN     "legacyApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewFeedback" TEXT,
ADD COLUMN     "reviewStatus" "TaskReviewStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "reviewedByName" TEXT,
ADD COLUMN     "submissionText" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_departmentId_reviewStatus_taskDate_idx" ON "Task"("departmentId", "reviewStatus", "taskDate");


-- Preserve existing completion credits; new tasks require explicit review.
UPDATE "Task" SET "reviewStatus" = 'APPROVED', "legacyApproved" = true WHERE "status" = 'DONE';
ALTER TABLE "Task" ADD CONSTRAINT "Task_approved_completion" CHECK (("status" = 'DONE') = ("reviewStatus" = 'APPROVED'));
ALTER TABLE "Task" ADD CONSTRAINT "Task_approval_evidence" CHECK ("reviewStatus" <> 'APPROVED' OR "legacyApproved" OR ("reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "Task" ADD CONSTRAINT "Task_no_self_review" CHECK ("reviewedById" IS NULL OR "reviewedById" <> "userId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignment_evidence" CHECK ("assignedById" IS NULL OR ("assignedById" <> "userId" AND "assignedByName" IS NOT NULL AND "assignedAt" IS NOT NULL AND "dueDate" IS NOT NULL));
ALTER TABLE "Task" ADD CONSTRAINT "Task_submission_evidence" CHECK ("reviewStatus" <> 'SUBMITTED' OR ("submittedAt" IS NOT NULL AND "submissionText" IS NOT NULL AND length(trim("submissionText")) > 0));
COMMIT;
