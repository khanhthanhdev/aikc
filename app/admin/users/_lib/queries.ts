import "server-only";

import type { Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "~/lib/auth";
import { prisma } from "~/services/prisma";
import { endOfAdminDay, startOfAdminDay } from "~/utils/admin-dates";
import { isAllowedEmail } from "~/utils/auth";
import type { GetUsersSchema } from "./validations";

export async function getUsers(input: GetUsersSchema) {
  noStore();
  const { page, per_page, sort, email, from, to } = input;

  try {
    const offset = (page - 1) * per_page;

    const [column, order] = (sort?.split(".").filter(Boolean) ?? [
      "createdAt",
      "asc",
    ]) as [
      keyof Prisma.UserOrderByWithRelationInput | undefined,
      "asc" | "desc" | undefined,
    ];

    const fromDate = from ? startOfAdminDay(from) : undefined;
    const toDate = to ? endOfAdminDay(to) : undefined;

    const where: Prisma.UserWhereInput = {
      role: "ADMIN",
      email: email ? { contains: email, mode: "insensitive" } : undefined,
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    const [users, usersTotal, session] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: column ? { [column]: order } : undefined,
        take: per_page,
        skip: offset,
      }),
      prisma.user.count({ where }),
      auth(),
    ]);

    const currentEmail = session?.user?.email?.toLowerCase();

    const pageCount = Math.ceil(usersTotal / per_page);

    return {
      users: users.map((user) => ({
        ...user,
        isCurrentUser: user.email.toLowerCase() === currentEmail,
        // Listed in ALLOWED_EMAILS: deleting the row would not remove access,
        // the next sign-in simply recreates it. Blocking is the way out.
        isFromEnv: isAllowedEmail(user.email),
      })),
      usersTotal,
      pageCount,
    };
  } catch (_err) {
    return { users: [], usersTotal: 0, pageCount: 0 };
  }
}

export type UserRow = Awaited<ReturnType<typeof getUsers>>["users"][number];

/** Placeholder the bulk import (data/ai-study-tools.ts) puts on every tool. */
const IMPORT_SUBMITTER_EMAIL = "system@stukit.com";

/**
 * People who suggested tools through the public submit form, newest first.
 * They only appear here for contact: none of them gets admin access.
 */
export async function getToolSubmitters() {
  noStore();

  try {
    const tools = await prisma.tool.findMany({
      where: { submitterEmail: { not: null } },
      select: {
        name: true,
        slug: true,
        submitterName: true,
        submitterEmail: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const submitters = new Map<
      string,
      {
        email: string;
        name: string | null;
        tools: Array<{ name: string; slug: string; publishedAt: Date | null }>;
        lastSubmittedAt: Date;
      }
    >();

    for (const { submitterEmail, submitterName, createdAt, ...tool } of tools) {
      const email = submitterEmail?.trim().toLowerCase();
      if (!email || email === IMPORT_SUBMITTER_EMAIL) {
        continue;
      }

      // Tools are newest first, so the first row sets the latest name and date
      const submitter = submitters.get(email) ?? {
        email,
        name: null,
        tools: [],
        lastSubmittedAt: createdAt,
      };
      submitter.name ||= submitterName?.trim() || null;
      submitter.tools.push(tool);
      submitters.set(email, submitter);
    }

    return [...submitters.values()];
  } catch (_err) {
    return [];
  }
}

export type ToolSubmitter = Awaited<
  ReturnType<typeof getToolSubmitters>
>[number];
