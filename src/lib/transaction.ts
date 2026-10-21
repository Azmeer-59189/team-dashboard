import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// Retry concurrent writes against a fresh snapshot, including all authorization checks.
export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 15000 });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2034" || attempt >= 2) throw error;
    }
  }
}

export class BusinessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
