import type { Session } from "next-auth";

// Central place for "what is this user allowed to touch" logic.
// ADMIN: everything. LEAD: only their own department. MEMBER: only their own tasks (handled elsewhere).
export type Scope = {
  isAdmin: boolean;
  isLead: boolean;
  departmentId: string | null;
  userId: string;
};

export function getScope(session: Session): Scope {
  return {
    isAdmin: session.user.role === "ADMIN",
    isLead: session.user.role === "LEAD",
    departmentId: session.user.departmentId,
    userId: session.user.id,
  };
}

// For routes only ADMIN or LEAD may call at all.
export function canManage(scope: Scope) {
  return scope.isAdmin || scope.isLead;
}

// A LEAD may only act within their own department; ADMIN may act on any department
// (including null/none, which is used for "no filter" contexts).
export function canAccessDepartment(scope: Scope, departmentId: string | null) {
  if (scope.isAdmin) return true;
  if (scope.isLead) return departmentId != null && departmentId === scope.departmentId;
  return false;
}
