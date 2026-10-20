#!/usr/bin/env bun
/**
 * List the reports nobody has dealt with yet, with the reported tool's state,
 * so each one can be fixed and then resolved in the admin. Read-only.
 *
 * Broken-link reports also get a fresh link check.
 *
 * Usage:
 *   bun run reports:open
 */

import { validateLink } from "~/lib/link-validator";
import { prisma } from "~/services/prisma";

/** Enough of the address to tell reporters apart without printing it whole. */
const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? "?"}`;
};

const toolStatus = (publishedAt: Date | null) => {
  if (!publishedAt) return "draft";
  return publishedAt > new Date() ? "scheduled" : "published";
};

const main = async () => {
  const reports = await prisma.report.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      tool: {
        select: {
          slug: true,
          name: true,
          websiteUrl: true,
          publishedAt: true,
          isBroken: true,
        },
      },
    },
  });

  console.log(`📮 ${reports.length} open report(s)\n`);

  for (const [index, report] of reports.entries()) {
    const { tool } = report;
    console.log(`[${index + 1}] ${report.type}  ${report.createdAt.toISOString().slice(0, 10)}  id=${report.id}`);
    console.log(`    from:    ${maskEmail(report.userEmail)}`);
    console.log(`    message: ${report.message?.trim() || "(none)"}`);
    console.log(`    tool:    ${tool.name} (${tool.slug}), ${toolStatus(tool.publishedAt)}${tool.isBroken ? ", flagged broken" : ""}`);
    console.log(`    url:     ${tool.websiteUrl}`);

    if (report.type === "BROKEN_LINK") {
      const result = await validateLink(tool.websiteUrl);
      const detail = result.error ?? `HTTP ${result.statusCode}`;
      console.log(`    check:   ${result.isValid ? "OK" : "BROKEN"} (${detail})`);
    }
    console.log();
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
