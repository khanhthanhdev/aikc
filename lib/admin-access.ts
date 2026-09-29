// No "server-only" import: proxy.ts imports this, and the proxy bundle does
// not resolve that package's react-server condition.
import { prisma } from "~/services/prisma";
import { isAllowedEmail } from "~/utils/auth";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Whether this email may use the admin panel right now.
 *
 * A row in the User table decides whenever one exists, so blocking an account
 * takes effect even when its email is also in ALLOWED_EMAILS. Without a row,
 * ALLOWED_EMAILS grants access; that is how the first admin gets in.
 *
 * This runs on every admin request (proxy), every server action and every
 * sign-in, because the JWT session alone would keep a blocked admin signed in
 * until it expired.
 */
export const hasAdminAccess = async (email?: string | null) => {
  if (!email) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { role: true, disabledAt: true },
  });

  if (user) {
    return user.role === "ADMIN" && !user.disabledAt;
  }

  return isAllowedEmail(email);
};

type AdminLogin = {
  email: string;
  name?: string | null;
  image?: string | null;
};

/**
 * Record a successful admin sign-in. Creates the row the first time an
 * ALLOWED_EMAILS admin signs in, so every admin shows up in /admin/users.
 */
export const recordAdminLogin = async ({ email, name, image }: AdminLogin) => {
  const now = new Date();

  await prisma.user.upsert({
    where: { email: normalizeEmail(email) },
    create: {
      email: normalizeEmail(email),
      name,
      image,
      role: "ADMIN",
      lastLoginAt: now,
    },
    update: { name, image, lastLoginAt: now },
  });
};
