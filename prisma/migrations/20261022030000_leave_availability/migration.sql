BEGIN;
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TABLE "LeaveRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 0,
  "reviewedById" TEXT,
  "reviewedByName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveRequest_dates" CHECK ("endDate">="startDate" AND "endDate"-"startDate"<366),
  CONSTRAINT "LeaveRequest_reason" CHECK (length(trim("reason")) BETWEEN 1 AND 2000),
  CONSTRAINT "LeaveRequest_version" CHECK ("version">=0),
  CONSTRAINT "LeaveRequest_review" CHECK ("status" NOT IN ('APPROVED','REJECTED') OR
    ("reviewedById" IS NOT NULL AND "reviewedById"<>"userId" AND "reviewedAt" IS NOT NULL)),
  CONSTRAINT "LeaveRequest_rejection" CHECK ("status"<>'REJECTED' OR length(trim(coalesce("reviewNote",'')))>0),
  CONSTRAINT "LeaveRequest_cancellation" CHECK (("status"='CANCELLED')=("cancelledAt" IS NOT NULL))
);
CREATE INDEX "LeaveRequest_userId_status_startDate_endDate_idx" ON "LeaveRequest"("userId","status","startDate","endDate");
CREATE INDEX "LeaveRequest_createdAt_id_idx" ON "LeaveRequest"("createdAt","id");
COMMIT;
