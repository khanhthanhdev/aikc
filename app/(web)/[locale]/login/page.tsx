import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { Button } from "~/components/web/ui/button";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { hasAdminAccess } from "~/lib/admin-access";
import { auth, signIn, signOut } from "~/lib/auth";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates } from "~/utils/seo";

const getMetadata = cache(
  async (locale: string, metadata?: Metadata): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: "Login" });
    return {
      ...metadata,
      title: t("title"),
    };
  }
);

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const metadata = await getMetadata(locale);

  return parseMetadata(
    metadata
      ? {
          alternates: buildAlternates(locale, "/login"),
          openGraph: { url: "/login" },
          ...metadata,
          noindex: true,
        }
      : {}
  );
}

export default async function LoginPage({ params, searchParams }: PageProps) {
  await connection();

  const { locale } = await params;
  const { error } = await searchParams;
  const t = await getTranslations({ locale, namespace: "Login" });
  const { title } = (await getMetadata(locale)) ?? {};

  const session = await auth();
  const email = session?.user?.email;

  // Only bounce to /admin when that will actually let them in; a blocked
  // account would otherwise loop between here and the proxy forever.
  if (email && (await hasAdminAccess(email))) {
    redirect("/admin");
  }

  const isDenied = Boolean(email) || error === "AccessDenied";

  const handleSignIn = async () => {
    "use server";
    await signIn("google", { redirectTo: "/admin" });
  };

  const handleSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    <Wrapper size="sm">
      <Intro>
        <IntroTitle>{title?.toString()}</IntroTitle>
      </Intro>

      {isDenied && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-red-600 text-sm dark:text-red-400">
          {email && (
            <>
              {t("signedInAs", { email })}
              <br />
            </>
          )}
          {t("accessDenied")}
        </p>
      )}

      {email ? (
        <Button className="mx-auto w-full" onClick={handleSignOut} size="lg">
          {t("useAnotherAccount")}
        </Button>
      ) : (
        <Button className="mx-auto w-full" onClick={handleSignIn} size="lg">
          {t("continueWithGoogle")}
        </Button>
      )}
    </Wrapper>
  );
}
