import type { Viewport } from "next";
import { type PropsWithChildren, Suspense } from "react";
import Providers from "~/app/providers";
import { routing } from "~/i18n/routing";
import { GeistSans, UncutSans } from "~/lib/fonts";

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      className={`${UncutSans.variable} ${GeistSans.variable}`}
      lang={routing.defaultLocale}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
        <Providers>
          <Suspense>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
