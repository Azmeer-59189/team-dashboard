import { test } from "node:test";
import assert from "node:assert/strict";
import { canManage, canManageUser, canAccessDepartment, type Scope } from "./scope";

const admin: Scope = { isAdmin: true, isLead: false, departmentId: null, userId: "admin" };
const lead: Scope = { isAdmin: false, isLead: true, departmentId: "design", userId: "lead" };
const orphanLead: Scope = { isAdmin: false, isLead: true, departmentId: null, userId: "orphan" };
const member: Scope = { isAdmin: false, isLead: false, departmentId: "design", userId: "m1" };

test("only admins and leads with a department can manage", () => {
  assert.equal(canManage(admin), true);
  assert.equal(canManage(lead), true);
  assert.equal(canManage(orphanLead), false);
  assert.equal(canManage(member), false);
});

test("a lead without a department matches no department", () => {
  assert.equal(canAccessDepartment(orphanLead, null), false);
  assert.equal(canAccessDepartment(lead, "design"), true);
  assert.equal(canAccessDepartment(lead, "dev"), false);
});

test("nobody manages themselves", () => {
  assert.equal(canManageUser(admin, { id: "admin", role: "ADMIN", departmentId: null }), false);
  assert.equal(canManageUser(lead, { id: "lead", role: "LEAD", departmentId: "design" }), false);
});

test("leads manage only ordinary members of their own department", () => {
  assert.equal(canManageUser(lead, { id: "m1", role: "MEMBER", departmentId: "design" }), true);
  assert.equal(canManageUser(lead, { id: "m2", role: "MEMBER", departmentId: "dev" }), false);
  assert.equal(canManageUser(lead, { id: "l2", role: "LEAD", departmentId: "design" }), false);
  assert.equal(canManageUser(lead, { id: "a2", role: "ADMIN", departmentId: "design" }), false);
  assert.equal(canManageUser(orphanLead, { id: "m3", role: "MEMBER", departmentId: null }), false);
});

test("admins manage anyone else, and members manage no one", () => {
  assert.equal(canManageUser(admin, { id: "l2", role: "LEAD", departmentId: "dev" }), true);
  assert.equal(canManageUser(member, { id: "m2", role: "MEMBER", departmentId: "design" }), false);
});
