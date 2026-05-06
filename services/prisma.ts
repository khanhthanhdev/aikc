import { PrismaClient } from "@prisma/client";

const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

declare global {
  var prismaInstance: ReturnType<typeof createPrismaClient> | undefined;
}

const prisma = globalThis.prismaInstance ?? createPrismaClient();

export { prisma };

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaInstance = prisma;
}
