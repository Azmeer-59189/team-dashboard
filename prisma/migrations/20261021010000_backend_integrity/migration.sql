BEGIN;
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "archivedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ManualScore" ADD COLUMN     "ratingKey" TEXT,
ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "details" JSONB,
ADD COLUMN     "targetId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GoalRevision" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "departmentId" TEXT,
    "userId" TEXT,
    "objectiveId" TEXT,
    "period" "GoalPeriod" NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "category" "GoalCategory" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReport" (
    "periodLabel" TEXT NOT NULL,
    "finalizedBy" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rows" JSONB NOT NULL,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("periodLabel")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "GoalRevision_period_effectiveFrom_idx" ON "GoalRevision"("period", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "GoalRevision_goalId_effectiveFrom_key" ON "GoalRevision"("goalId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "LoginAttempt_expiresAt_idx" ON "LoginAttempt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManualScore_ratingKey_key" ON "ManualScore"("ratingKey");

-- CreateIndex
CREATE INDEX "Task_userId_status_taskDate_idx" ON "Task"("userId", "status", "taskDate");

-- CreateIndex
CREATE INDEX "Task_departmentId_taskDate_idx" ON "Task"("departmentId", "taskDate");

-- CreateIndex
CREATE INDEX "Task_objectiveId_status_taskDate_idx" ON "Task"("objectiveId", "status", "taskDate");


-- Existing assessments stay in storage; only the latest identifiable reviewer entry counts.
WITH ranked AS (
 SELECT "id", row_number() OVER (PARTITION BY "userId", "periodLabel", lower(trim("competency")), coalesce("scorerId", "id")
 ORDER BY "createdAt" DESC, "id" DESC) AS position FROM "ManualScore"
)
UPDATE "ManualScore" SET "supersededAt" = CURRENT_TIMESTAMP FROM ranked
WHERE "ManualScore"."id" = ranked."id" AND ranked.position > 1;
UPDATE "ManualScore" SET "updatedAt" = "createdAt", "competency" = trim("competency");

-- Initial history is a baseline of the targets known at migration time.
INSERT INTO "GoalRevision" ("id", "goalId", "departmentId", "userId", "objectiveId", "period", "targetCount", "category", "weight", "effectiveFrom", "createdAt")
SELECT 'baseline_' || "id", "id", "departmentId", "userId", "objectiveId", "period", "targetCount", "category", "weight",
 date_trunc(CASE "period" WHEN 'WEEKLY' THEN 'week' WHEN 'MONTHLY' THEN 'month' ELSE 'year' END, "createdAt")::date, "createdAt"
FROM "Goal";

-- Abort rather than silently merge accounts whose normalized emails collide.
CREATE UNIQUE INDEX "User_email_normalized_key" ON "User" (lower(trim("email")));
UPDATE "User" SET "email" = lower(trim("email"));

-- NOT VALID preserves legacy rows for review while enforcing rules on new writes.
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_one_owner" CHECK (("userId" IS NULL) <> ("departmentId" IS NULL)) NOT VALID;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_positive_target" CHECK ("targetCount" > 0 AND "weight" > 0 AND "weight" < 'Infinity'::float8) NOT VALID;
ALTER TABLE "GoalRevision" ADD CONSTRAINT "GoalRevision_one_owner" CHECK (("userId" IS NULL) <> ("departmentId" IS NULL)) NOT VALID;
ALTER TABLE "GoalRevision" ADD CONSTRAINT "GoalRevision_positive_target" CHECK ("targetCount" > 0 AND "weight" > 0 AND "weight" < 'Infinity'::float8) NOT VALID;
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_positive_target" CHECK ("targetTaskCount" IS NULL OR "targetTaskCount" > 0) NOT VALID;
ALTER TABLE "ManualScore" ADD CONSTRAINT "ManualScore_range" CHECK ("score" >= 0 AND "score" <= 10) NOT VALID;
ALTER TABLE "ManualScore" ADD CONSTRAINT "ManualScore_month" CHECK ("periodLabel" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND left("periodLabel",4) <> '0000') NOT VALID;
ALTER TABLE "Task" ADD CONSTRAINT "Task_nonnegative_revisions" CHECK ("revisionRounds" IS NULL OR "revisionRounds" >= 0) NOT VALID;
CREATE TABLE "UserAssignment" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "departmentId" TEXT, "role" "Role" NOT NULL,
 "archived" BOOLEAN NOT NULL DEFAULT false, "effectiveFrom" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "UserAssignment_userId_effectiveFrom_key" ON "UserAssignment"("userId", "effectiveFrom");
INSERT INTO "UserAssignment" ("id", "userId", "departmentId", "role", "effectiveFrom", "createdAt")
SELECT 'baseline_' || "id", "id", "departmentId", "role", "createdAt"::date, "createdAt" FROM "User";
COMMIT;
