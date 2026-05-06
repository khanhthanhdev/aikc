import type { Viewport } from "next";
import { getLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import Providers from "~/app/providers";
import { GeistSans, UncutSans } from "~/lib/fonts";

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const locale = await getLocale();

  return (
    <html
      className={`${UncutSans.variable} ${GeistSans.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
