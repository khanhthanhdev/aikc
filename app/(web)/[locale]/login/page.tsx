import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { Button } from "~/components/web/ui/button";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { auth, signIn } from "~/lib/auth";
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
}

export const dynamic = "force-dynamic";

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

export default async function LoginPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Login" });
  const { title } = (await getMetadata(locale)) ?? {};

  const session = await auth();

  if (session?.user) {
    redirect("/admin");
  }

  const handleSignIn = async () => {
    "use server";
    await signIn("google", { redirectTo: "/admin" });
  };

  return (
    <Wrapper size="sm">
      <Intro>
        <IntroTitle>{title?.toString()}</IntroTitle>
      </Intro>

      <Button className="mx-auto w-full" onClick={handleSignIn} size="lg">
        {t("continueWithGoogle")}
      </Button>
    </Wrapper>
  );
}
