// Creates the first admin account. Run once with: npm run seed
// Edit the values below before running, or set them via env vars.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@company.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const fullName = process.env.SEED_ADMIN_NAME ?? "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { fullName, email, passwordHash, role: "ADMIN" },
  });

  console.log(`Created admin user: ${email} (password: ${password})`);
  console.log("Log in with these, then change the password by recreating the account from the admin panel.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
