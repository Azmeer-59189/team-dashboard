export function ratingKey(userId: string, month: string, competency: string, scorerId: string) {
  // JSON avoids delimiter collisions and is mirrored by the migration backfill.
  return JSON.stringify([userId, month, competency.trim().toLowerCase(), scorerId]);
}
