import type { Task } from "@prisma/client";
import { canManageUser, type Scope } from "./scope";
import { BusinessError } from "./transaction";
import { isText, isOptionalText } from "./input";

export const TASK_ACTIONS = ["start", "submit", "approve", "request_changes", "reopen"] as const;
export type TaskAction = (typeof TASK_ACTIONS)[number];
export type ReviewTask = Pick<Task, "userId" | "departmentId" | "status" | "reviewStatus" | "submissionText" | "assignedById">;
export type TaskOwner = { id: string; departmentId: string | null; role: string };

export function canReviewTask(scope: Scope, task: Pick<Task, "userId" | "departmentId">, owner: TaskOwner) {
  return canManageUser(scope, owner) && task.userId === owner.id
    && (scope.isAdmin || task.departmentId === scope.departmentId);
}

export function validateAction(body: Record<string, unknown>) {
  if (!TASK_ACTIONS.includes(body.action as TaskAction)) return "Invalid task action";
  if (!Number.isInteger(body.version) || Number(body.version) < 0) return "Provide the current task version";
  if (!isOptionalText(body.note, 5000)) return "Notes must be under 5000 characters";
  if ((body.action === "submit" || body.action === "request_changes" || body.action === "reopen") && !isText(body.note, 5000)) {
    return body.action === "submit" ? "Describe the completed work or provide its link" : "Please provide a reason";
  }
  return null;
}

// The only path to DONE/APPROVED. Both APIs and tests use these same transitions.
export function taskTransition(task: ReviewTask, scope: Scope, owner: TaskOwner, action: TaskAction, note: string, now = new Date()) {
  const own = scope.userId === task.userId;
  const reviewer = canReviewTask(scope, task, owner);
  const clearReview = { reviewedById: null, reviewedByName: null, reviewedAt: null, legacyApproved: false };
  if (action === "approve" || action === "request_changes") {
    if (!reviewer) throw new BusinessError("You cannot review this task", 403);
    if (task.reviewStatus !== "SUBMITTED") throw new BusinessError("Only submitted tasks can be reviewed", 409);
    if (action === "request_changes" && !isText(note, 5000)) throw new BusinessError("Feedback is required");
    return { status: action === "approve" ? "DONE" as const : "IN_PROGRESS" as const,
      ...(action === "request_changes" ? { completedAt: null } : {}),
      reviewStatus: action === "approve" ? "APPROVED" as const : "CHANGES_REQUESTED" as const,
      reviewedById: scope.userId, reviewedAt: now, reviewFeedback: note.trim() || null, legacyApproved: false };
  }
  if (!own) throw new BusinessError("Only the task owner can start, submit, or reopen their work", 403);
  if (action === "submit") {
    if (!["DRAFT", "CHANGES_REQUESTED"].includes(task.reviewStatus)) throw new BusinessError("This task cannot be submitted in its current state", 409);
    if (!isText(note, 5000)) throw new BusinessError("Describe the completed work or provide its link");
    return { ...clearReview, status: "IN_PROGRESS" as const, reviewStatus: "SUBMITTED" as const,
      submissionText: note.trim(), submittedAt: now, completedAt: now, reviewFeedback: null };
  }
  if (action === "reopen") {
    if (task.reviewStatus !== "APPROVED") throw new BusinessError("Only approved tasks can be reopened", 409);
    if (!isText(note, 5000)) throw new BusinessError("Please provide a reason");
    return { ...clearReview, status: "IN_PROGRESS" as const, reviewStatus: "DRAFT" as const,
      completedAt: null, submittedAt: null, reviewFeedback: null };
  }
  if (task.reviewStatus !== "DRAFT" || task.status !== "PENDING") throw new BusinessError("This task has already started", 409);
  return { status: "IN_PROGRESS" as const };
}
