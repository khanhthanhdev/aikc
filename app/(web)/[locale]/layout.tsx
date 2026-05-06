import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { JsonLd } from "~/components/common/json-ld";
import { AdBanner } from "~/components/web/ads/ad-banner";
import { ChatProvider } from "~/components/web/ai-chat/chat-context";
import { ClientWidgets } from "~/components/web/client-widgets";
import { Footer } from "~/components/web/footer";
import { Header } from "~/components/web/header";
import { Container } from "~/components/web/ui/container";
import { Stars } from "~/components/web/ui/stars";
import { Toaster } from "~/components/web/ui/toaster";
import { Wrapper } from "~/components/web/ui/wrapper";
import { config } from "~/config";
import { CommandPaletteProvider } from "~/contexts/command-palette-context";
import { routing } from "~/i18n/routing";
import { buildOrganizationSchema, buildWebSiteSchema } from "~/lib/json-ld";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates } from "~/utils/seo";

import "./styles.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const metadata = parseMetadata({});

  return {
    metadataBase: config.site.url ? new URL(config.site.url) : undefined,
    manifest: "/manifest.json",
    alternates: buildAlternates(locale, "/"),
    ...metadata,
    title: {
      default: t("siteName"),
      template: `%s | ${t("siteName")}`,
    },
    openGraph: {
      ...metadata.openGraph,
      locale: locale === "vi" ? "vi_VN" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: t("siteName"),
      description: config.site.description,
      images: metadata.openGraph?.images,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: PropsWithChildren<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider messages={messages}>
      <ChatProvider>
        <CommandPaletteProvider>
          {/* JSON-LD Schemas for SEO */}
          <JsonLd data={buildOrganizationSchema()} />
          <JsonLd data={buildWebSiteSchema()} />

          <div className="absolute inset-x-0 top-0 -z-10 mx-auto aspect-[2/1] max-w-screen-lg overflow-hidden">
            <Stars className="absolute top-1/2 left-1/2 size-full -translate-x-1/2 -translate-y-1/2" />
          </div>

          <Header>
            <AdBanner />
          </Header>

          <Container
            asChild
            className="flex flex-1 flex-col gap-12 pt-12 pb-8 md:gap-16 md:pt-16 lg:gap-20 lg:pt-20"
          >
            <main>
              {children}

              <Wrapper className="mt-auto">
                <hr className="relative left-1/2 hidden w-screen -translate-x-1/2 first:block" />

                <Footer />
              </Wrapper>
            </main>
          </Container>

          <Toaster />

          <ClientWidgets />
        </CommandPaletteProvider>
      </ChatProvider>
    </NextIntlClientProvider>
  );
}
