"use server";

import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { authedProcedure } from "~/lib/safe-actions";
import { prisma } from "~/services/prisma";
import { reportIdsSchema, resolveReportsSchema } from "./validations";

const revalidateReports = () => {
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  // The sidebar shows the open report count from the cached admin stats;
  // expire it now so the badge drops on the next render, not the one after.
  revalidateTag("admin-stats", { expire: 0 });
};

export const resolveReports = authedProcedure
  .createServerAction()
  .input(resolveReportsSchema)
  .handler(async ({ input: { ids, resolved } }) => {
    await prisma.report.updateMany({
      where: { id: { in: ids } },
      data: { resolvedAt: resolved ? new Date() : null },
    });

    revalidateReports();

    return true;
  });

export const deleteReports = authedProcedure
  .createServerAction()
  .input(reportIdsSchema)
  .handler(async ({ input: { ids } }) => {
    await prisma.report.deleteMany({
      where: { id: { in: ids } },
    });

    revalidateReports();

    return true;
  });
