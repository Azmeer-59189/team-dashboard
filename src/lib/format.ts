import type { Task, User, Department } from "@prisma/client";

// Frontend uses lowercase/hyphenated values (matches the old Supabase build);
// Prisma/Postgres enums are UPPER_SNAKE. These convert between the two so the
// existing components (TaskTable, TaskForm, FilterBar) don't need to change.

export function statusToDb(status: string) {
  return status.toUpperCase().replace(/-/g, "_") as "PENDING" | "IN_PROGRESS" | "DONE";
}
export function statusFromDb(status: string) {
  return status.toLowerCase().replace(/_/g, "-");
}
export function typeToDb(type: string) {
  return type.toUpperCase() as "TEXT" | "LINK";
}
export function typeFromDb(type: string) {
  return type.toLowerCase() as "text" | "link";
}

export function priorityToDb(priority: string) {
  return priority.toUpperCase() as "LOW" | "MEDIUM" | "HIGH";
}
export function priorityFromDb(priority: string | null) {
  return priority ? priority.toLowerCase() : null;
}

type TaskWithRelations = Task & {
  user?: Pick<User, "fullName"> | null;
  department?: Pick<Department, "name"> | null;
};

function dateOrNull(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function formatTask(task: TaskWithRelations) {
  return {
    id: task.id,
    version: task.version,
    cancelled_at: task.cancelledAt?.toISOString() ?? null,
    cancelled_by: task.cancelledByName,
    cancellation_reason: task.cancellationReason,
    objective_id: task.objectiveId,
    user_id: task.userId,
    review_status: task.reviewStatus,
    assigned_by: task.assignedByName,
    assigned_by_id: task.assignedById,
    submission_text: task.submissionText,
    submitted_at: task.submittedAt?.toISOString() ?? null,
    review_feedback: task.reviewFeedback,
    reviewed_by: task.reviewedByName,
    reviewed_at: task.reviewedAt?.toISOString() ?? null,
    legacy_approved: task.legacyApproved,
    completed_at: task.completedAt?.toISOString() ?? null,
    content: task.content,
    type: typeFromDb(task.type),
    task_date: task.taskDate.toISOString().slice(0, 10),
    status: statusFromDb(task.status),
    category: task.category,
    chapter: task.chapter,
    campaign: task.campaign,
    priority: priorityFromDb(task.priority),
    due_date: dateOrNull(task.dueDate),
    delivered_date: dateOrNull(task.deliveredDate),
    revision_rounds: task.revisionRounds,
    profiles: task.user ? { full_name: task.user.fullName } : null,
    departments: task.department ? { name: task.department.name } : null,
  };
}

export function formatMember(user: User & { department?: Pick<Department, "name"> | null }) {
  return {
    id: user.id,
    archived_at: user.archivedAt?.toISOString() ?? null,
    full_name: user.fullName,
    email: user.email,
    role: user.role.toLowerCase(),
    job_title: user.jobTitle,
    department_id: user.departmentId,
    departments: user.department ? { name: user.department.name } : null,
  };
}
