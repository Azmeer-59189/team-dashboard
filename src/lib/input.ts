export const isText = (value: unknown, max: number, required = true): value is string =>
  typeof value === "string" && (!required || value.trim().length > 0) && value.trim().length <= max;
export const isOptionalText = (value: unknown, max: number) => value == null || isText(value, max, false);
export const isId = (value: unknown): value is string => isText(value, 191);
export const isMonth = (value: unknown): value is string =>
  typeof value === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const isNumber = (value: unknown) =>
  (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value));
export const isPositiveCount = (value: unknown) =>
  isNumber(value) && Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
export const isPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 6 && Buffer.byteLength(value, "utf8") <= 72;

export function validateGoalInput(body: Record<string, unknown>) {
  if (!isPositiveCount(body.targetCount)) return "Target must be a positive whole number";
  if (body.weight != null && body.weight !== "" && (!isNumber(body.weight) || Number(body.weight) <= 0)) return "Weight must be a positive number";
  if (body.category !== undefined && !["CORE", "BEHAVIOURAL"].includes(String(body.category))) return "Invalid goal category";
  return null;
}

export function validateObjectiveInput(body: Record<string, unknown>, partial = false) {
  if ((!partial || "title" in body) && !isText(body.title, 200)) return "Title must be 1-200 characters";
  if (!isOptionalText(body.description, 5000)) return "Description must be under 5000 characters";
  if (body.targetTaskCount != null && body.targetTaskCount !== "" && !isPositiveCount(body.targetTaskCount)) return "Task target must be a positive whole number";
  return null;
}

export function validateRatingInput(body: Record<string, unknown>) {
  if (!isId(body.userId)) return "Member is required";
  if (!isText(body.competency, 100)) return "Competency must be 1-100 characters";
  if (!isNumber(body.score) || Number(body.score) < 0 || Number(body.score) > 10) return "Score must be between 0 and 10";
  if (!isMonth(body.periodLabel)) return "Period must be a real month in YYYY-MM format";
  if (!isOptionalText(body.notes, 5000)) return "Notes must be under 5000 characters";
  return null;
}

export function validateMemberInput(body: Record<string, unknown>) {
  if (!isText(body.full_name, 200)) return "Name must be 1-200 characters";
  if (!isText(body.email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return "Invalid email address";
  if (!isPassword(body.password)) return "Password must be at least 6 characters and at most 72 UTF-8 bytes";
  if (!isOptionalText(body.job_title, 150)) return "Job title must be under 150 characters";
  if (!isOptionalText(body.department, 200)) return "Invalid department";
  if (body.department_id != null && body.department_id !== "" && !isId(body.department_id)) return "Invalid department";
  if (body.role !== undefined && (typeof body.role !== "string" || !["ADMIN", "LEAD", "MEMBER"].includes(body.role.toUpperCase()))) return "Invalid role";
  return null;
}
