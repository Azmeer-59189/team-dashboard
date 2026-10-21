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

// For routes only ADMIN or LEAD may call at all. A LEAD with no department (e.g. their
// department was deleted) manages nothing: every lead filter is "departmentId = mine",
// and with mine = null that would match unassigned users across the whole organization.
export function canManage(scope: Scope) {
  return scope.isAdmin || (scope.isLead && scope.departmentId != null);
}

// Whether `scope` may act on one specific person: rate them, set their goals, reset
// their password, remove them. Nobody acts on themselves this way, and a LEAD may only
// act on ordinary members of their own department.
export function canManageUser(scope: Scope, target: { id: string; role: string; departmentId: string | null }) {
  if (target.id === scope.userId) return false;
  if (scope.isAdmin) return true;
  return canManage(scope) && target.role === "MEMBER" && target.departmentId === scope.departmentId;
}

// A LEAD may only act within their own department; ADMIN may act on any department
// (including null/none, which is used for "no filter" contexts).
export function canAccessDepartment(scope: Scope, departmentId: string | null) {
  if (scope.isAdmin) return true;
  if (scope.isLead) return departmentId != null && departmentId === scope.departmentId;
  return false;
}
