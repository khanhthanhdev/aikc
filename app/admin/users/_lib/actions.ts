"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inviteUserSchema } from "~/app/admin/users/_lib/validations";
import { normalizeEmail } from "~/lib/admin-access";
import { authedProcedure } from "~/lib/safe-actions";
import { prisma } from "~/services/prisma";
import { isAllowedEmail } from "~/utils/auth";

/**
 * Refuse any change that touches the signed-in admin's own row. Blocking or
 * deleting yourself is the only way to end up with no admin at all, since
 * every other change leaves at least the person making it.
 */
const assertNotSelf = async (ids: string[], currentEmail?: string | null) => {
  if (!currentEmail) {
    throw new Error("Could not identify the signed-in admin");
  }

  const self = await prisma.user.findFirst({
    where: { id: { in: ids }, email: normalizeEmail(currentEmail) },
    select: { id: true },
  });

  if (self) {
    throw new Error("You cannot block or remove your own account");
  }
};

export const inviteUser = authedProcedure
  .createServerAction()
  .input(inviteUserSchema)
  .handler(async ({ input: { email, name }, ctx: { user } }) => {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    if (existing?.role === "ADMIN") {
      throw new Error(`${email} is already an admin`);
    }

    const invited = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: name || null,
        role: "ADMIN",
        invitedBy: user.email ?? null,
      },
      update: {
        role: "ADMIN",
        disabledAt: null,
        invitedBy: user.email ?? null,
      },
    });

    revalidatePath("/admin/users");

    return invited;
  });

export const setUsersDisabled = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()).min(1), disabled: z.boolean() }))
  .handler(async ({ input: { ids, disabled }, ctx: { user } }) => {
    if (disabled) {
      await assertNotSelf(ids, user.email);
    }

    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { disabledAt: disabled ? new Date() : null },
    });

    revalidatePath("/admin/users");

    return true;
  });

export const deleteUsers = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()).min(1) }))
  .handler(async ({ input: { ids }, ctx: { user } }) => {
    await assertNotSelf(ids, user.email);

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { email: true },
    });

    // Deleting an ALLOWED_EMAILS row would look like it worked, then the next
    // sign-in would quietly recreate it with full access.
    const fromEnv = users.filter(({ email }) => isAllowedEmail(email));

    if (fromEnv.length) {
      throw new Error(
        `${fromEnv.map(({ email }) => email).join(", ")} ${
          fromEnv.length === 1 ? "is" : "are"
        } listed in ALLOWED_EMAILS, so deleting would not remove access. Block instead.`
      );
    }

    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });

    revalidatePath("/admin/users");

    return true;
  });
