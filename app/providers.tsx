"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";
import { SmoothScroll } from "~/components/common/smooth-scroll";
import { ThemeProvider } from "~/components/common/theme-provider";

export default function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <SmoothScroll />
      <NuqsAdapter>{children}</NuqsAdapter>
    </ThemeProvider>
  );
}
