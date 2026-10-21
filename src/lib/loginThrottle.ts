import { createHash } from "crypto";
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

// An atomic database counter works across concurrent requests and server instances.
// Use the normalized account, not an untrusted forwarded IP header.
export async function allowLogin(email: string, db: Pick<Prisma.TransactionClient, "loginAttempt" | "$queryRaw"> = prisma) {
  const key = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  const now = new Date();
  await db.loginAttempt.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400000) } } });
  const rows = await db.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "LoginAttempt" ("key", "attempts", "expiresAt") VALUES (${key}, 1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "LoginAttempt"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 1 ELSE LEAST("LoginAttempt"."attempts" + 1, 11) END,
      "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '15 minutes' ELSE "LoginAttempt"."expiresAt" END
    RETURNING "attempts"
  `;
  return rows[0].attempts <= 10;
}
