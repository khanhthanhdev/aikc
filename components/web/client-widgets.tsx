"use client";

import dynamic from "next/dynamic";
import { PageViewTracker } from "~/components/web/page-view-tracker";

const AIChatWidget = dynamic(
  () => import("~/components/web/ai-chat").then((mod) => mod.AIChatWidget),
  {
    ssr: false,
  }
);
const RoleDialog = dynamic(
  () =>
    import("~/components/web/roles/role-dialog").then((mod) => mod.RoleDialog),
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
      <RoleDialog />
      <PageViewTracker />
    </>
  );
}
