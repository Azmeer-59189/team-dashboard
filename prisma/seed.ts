// Creates the first admin account. Run once with: npm run seed
// Edit the values below before running, or set them via env vars.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recordAssignment } from "../src/lib/assignments";
import { isPassword } from "../src/lib/input";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@company.com").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const fullName = process.env.SEED_ADMIN_NAME ?? "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, skipping.`);
    return;
  }

  if (!isPassword(password)) throw new Error("Seed password must be at least 6 characters and at most 72 UTF-8 bytes");
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { fullName, email, passwordHash, role: "ADMIN" } });
    await recordAssignment(tx, user);
  });

  console.log(`Created admin user: ${email}`);
  console.log("Log in with your configured seed password, then change it from Account.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
