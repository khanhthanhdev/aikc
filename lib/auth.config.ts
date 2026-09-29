import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "~/env";
import { hasAdminAccess, recordAdminLogin } from "~/lib/admin-access";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,

  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],

  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email;

      if (!(email && (await hasAdminAccess(email)))) {
        return false;
      }

      await recordAdminLogin({
        email,
        name: profile?.name,
        image: typeof profile?.picture === "string" ? profile.picture : null,
      });

      return true;
    },
  },

  pages: {
    signIn: "/login",
    // A refused sign-in lands on /login?error=AccessDenied instead of the
    // bare Auth.js error page.
    error: "/login",
  },
});
