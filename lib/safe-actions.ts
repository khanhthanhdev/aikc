import { createServerActionProcedure } from "zsa";
import { hasAdminAccess } from "~/lib/admin-access";
import { auth } from "~/lib/auth";

export const authedProcedure = createServerActionProcedure().handler(
  async () => {
    const session = await auth();

    if (!session?.user) {
      throw new Error("User not authenticated");
    }

    // The session is a JWT that outlives a block, so check the database too.
    if (!(await hasAdminAccess(session.user.email))) {
      throw new Error("User not authorized");
    }

    return { user: session.user };
  }
);
