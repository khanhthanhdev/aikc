"use client";

import dynamic from "next/dynamic";

const AIChatWidget = dynamic(
  () => import("~/components/web/ai-chat").then((mod) => mod.AIChatWidget),
  {
    ssr: false,
  }
);
const CommandPalette = dynamic(
  () =>
    import("~/components/web/command-palette").then(
      (mod) => mod.CommandPalette
    ),
  {
    ssr: false,
  }
);

export function ClientWidgets() {
  return (
    <>
      <AIChatWidget />
      <CommandPalette />
    </>
  );
}
