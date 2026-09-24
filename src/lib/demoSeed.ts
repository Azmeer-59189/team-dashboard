import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "demopass123";

const SAMPLE_TASKS: Record<string, { text: string[]; link: string[] }> = {
  Design: {
    text: [
      "Designed homepage hero section mockup",
      "Created 3 Instagram post templates",
      "Revised logo color variations per feedback",
      "Built icon set for mobile app",
      "Prepared moodboard for Q3 campaign",
    ],
    link: ["https://figma.com/file/homepage-redesign", "https://figma.com/file/social-templates"],
  },
  Development: {
    text: [
      "Fixed login redirect bug on mobile",
      "Implemented pagination for tasks API",
      "Refactored auth middleware",
      "Wrote unit tests for payment module",
      "Optimized database queries for dashboard",
    ],
    link: ["https://github.com/org/repo/pull/142", "https://github.com/org/repo/pull/156"],
  },
  Content: {
    text: [
      "Wrote blog post on onboarding best practices",
      "Drafted newsletter for October",
      "Edited landing page copy",
      "Wrote 3 social captions for product launch",
      "Researched keywords for SEO article",
    ],
    link: ["https://docs.google.com/document/d/blog-draft-1", "https://docs.google.com/document/d/newsletter-oct"],
  },
  Grants: {
    text: [
      "Submitted quarterly grant report",
      "Researched 5 new funding opportunities",
      "Drafted grant proposal for community program",
      "Followed up with foundation contact",
      "Compiled budget for grant renewal",
    ],
    link: ["https://docs.google.com/document/d/grant-proposal-draft"],
  },
};

function randomStatus(i: number) {
  const r = i % 5;
  if (r === 0) return "PENDING";
  if (r === 1) return "IN_PROGRESS";
  return "DONE";
}

export async function seedDemoData() {
  // wipe in FK-safe order (children before parents)
  await prisma.goal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  const departments = await Promise.all(
    ["Design", "Development", "Content", "Grants"].map((name) => prisma.department.create({ data: { name } }))
  );
  const deptByName = Object.fromEntries(departments.map((d) => [d.name, d]));

  const adminHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.create({
    data: {
      fullName: "Demo Admin",
      email: "demo-admin@example.com",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  const leadHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const lead = await prisma.user.create({
    data: {
      fullName: "Demo Lead (Design)",
      email: "demo-lead@example.com",
      passwordHash: leadHash,
      role: "LEAD",
      departmentId: deptByName["Design"].id,
    },
  });

  const memberNames: Record<string, string[]> = {
    Design: ["Ava Chen"],
    Development: ["Marcus Reed", "Priya Nair"],
    Content: ["Jordan Lee"],
    Grants: ["Sofia Marino"],
  };

  const memberHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const members = [];
  for (const [deptName, names] of Object.entries(memberNames)) {
    for (const name of names) {
      const email = `demo-${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
      const member = await prisma.user.create({
        data: {
          fullName: name,
          email,
          passwordHash: memberHash,
          role: "MEMBER",
          departmentId: deptByName[deptName].id,
        },
      });
      members.push({ ...member, deptName });
    }
  }

  // generate ~18 tasks per member over the last 30 days
  for (const member of members) {
    const bank = SAMPLE_TASKS[member.deptName];
    for (let i = 0; i < 18; i++) {
      const daysAgo = Math.floor((i / 18) * 29);
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - daysAgo);
      date.setUTCHours(0, 0, 0, 0);

      const useLink = i % 4 === 0;
      const content = useLink
        ? bank.link[i % bank.link.length]
        : bank.text[i % bank.text.length];

      await prisma.task.create({
        data: {
          userId: member.id,
          departmentId: deptByName[member.deptName].id,
          type: useLink ? "LINK" : "TEXT",
          content,
          taskDate: date,
          status: randomStatus(i) as any,
        },
      });
    }
  }

  // sample KPI goals so Progress/Goals pages have something to show
  const designGoal = await prisma.goal.create({
    data: { departmentId: deptByName["Design"].id, period: "MONTHLY", targetCount: 12 },
  });
  await prisma.goal.create({
    data: { departmentId: deptByName["Development"].id, period: "WEEKLY", targetCount: 4 },
  });
  await prisma.goal.create({
    data: { userId: members.find((m) => m.deptName === "Content")!.id, period: "MONTHLY", targetCount: 10 },
  });

  // sample Objective, linked to the Design KPI above, so the Objectives page has real data to show
  const objective = await prisma.objective.create({
    data: {
      departmentId: deptByName["Design"].id,
      title: "Grow brand awareness this quarter",
      description: "Ship consistent, on-brand visual content across channels.",
      targetTaskCount: 15,
    },
  });
  await prisma.goal.update({ where: { id: designGoal.id }, data: { objectiveId: objective.id } });
  // tag a few of the design member's existing tasks to this objective
  const designMember = members.find((m) => m.deptName === "Design")!;
  const someDesignTasks = await prisma.task.findMany({ where: { userId: designMember.id }, take: 6 });
  await Promise.all(
    someDesignTasks.map((t) => prisma.task.update({ where: { id: t.id }, data: { objectiveId: objective.id } }))
  );

  return {
    admin: { email: "demo-admin@example.com", password: DEMO_PASSWORD },
    lead: { email: "demo-lead@example.com", password: DEMO_PASSWORD },
    member: { email: members[0].email, password: DEMO_PASSWORD },
  };
}
