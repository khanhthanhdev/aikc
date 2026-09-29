import { env } from "~/env";

/**
 * Check if the email is listed in ALLOWED_EMAILS.
 *
 * ALLOWED_EMAILS bootstraps admin access before anyone has been added from
 * /admin/users. An empty value allows nobody: it used to allow every Google
 * account, which turned a missing env var into an open admin panel.
 *
 * @param email - The email to check
 * @returns - True if the email or its domain is listed, false otherwise
 */
export const isAllowedEmail = (email?: string | null): boolean => {
  if (!(env.ALLOWED_EMAILS && email)) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Clean up the allowed emails
  const allowedEmails = env.ALLOWED_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Allow specified emails, or whole domains written as "vinuni.edu.vn" or
  // "@vinuni.edu.vn". Domains match on "@domain" so "evilvinuni.edu.vn"
  // cannot pass for "vinuni.edu.vn".
  return allowedEmails.some((e) => {
    if (e.includes("@") && !e.startsWith("@")) {
      return normalizedEmail === e;
    }

    return normalizedEmail.endsWith(e.startsWith("@") ? e : `@${e}`);
  });
};
