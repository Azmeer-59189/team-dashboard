const MAX_CONTENT_LENGTH = 5000;
const VALID_TYPES = ["text", "link"];
const VALID_STATUSES = ["pending", "in-progress", "done"];

export function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDate(value: string) {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

// Validates whatever subset of task fields is present (works for both full
// create payloads and partial update payloads). Returns an error string, or
// null if everything provided is valid.
export function validateTaskFields(fields: {
  type?: string;
  content?: string;
  task_date?: string;
  status?: string;
}): string | null {
  if (fields.type !== undefined && !VALID_TYPES.includes(fields.type)) {
    return "Task type must be 'text' or 'link'";
  }
  if (fields.status !== undefined && !VALID_STATUSES.includes(fields.status)) {
    return "Status must be pending, in-progress, or done";
  }
  if (fields.content !== undefined) {
    const trimmed = fields.content.trim();
    if (trimmed.length === 0) return "Task content can't be empty";
    if (trimmed.length > MAX_CONTENT_LENGTH) return `Task content must be under ${MAX_CONTENT_LENGTH} characters`;
    if (fields.type === "link" && !isValidUrl(trimmed)) {
      return "Link tasks need a valid http:// or https:// URL";
    }
  }
  if (fields.task_date !== undefined && !isValidDate(fields.task_date)) {
    return "Task date is not a valid date";
  }
  return null;
}
