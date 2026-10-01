"use client";

import {
  FlagIcon,
  GemIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  ShapesIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import * as React from "react";
import { Nav } from "~/components/admin/nav";
import { NavMain } from "~/components/admin/nav-main";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/admin/ui/resizable";
import { Separator } from "~/components/admin/ui/separator";
import { siteConfig } from "~/config/site";
import { useIsMobile } from "~/hooks/use-mobile";
import { useStats } from "~/hooks/use-stats-context";
import { cx } from "~/utils/cva";

interface ShellProps extends React.PropsWithChildren {
  defaultCollapsed?: boolean;
  defaultLayout: number[] | undefined;
  navCollapsedSize?: number;
}

export function Shell({
  children,
  defaultLayout = [20, 48],
  defaultCollapsed = false,
  navCollapsedSize = 0,
}: ShellProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const stats = useStats();
  const isMobile = useIsMobile();

  return (
    <ResizablePanelGroup
      className="h-full items-stretch"
      direction="horizontal"
      onLayout={(sizes) => {
        document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`;
      }}
    >
      <ResizablePanel
        className={cx(
          "group/collapsible sticky top-0 z-40 flex h-dvh flex-col",
          isCollapsed
            ? "min-w-12 transition-all duration-300 ease-in-out"
            : "min-w-52 max-w-64"
        )}
        collapsedSize={navCollapsedSize}
        collapsible={true}
        data-collapsed={isCollapsed}
        defaultSize={defaultLayout[0]}
        maxSize={isMobile ? navCollapsedSize : 20}
        minSize={isMobile ? navCollapsedSize : 5}
        onCollapse={() => {
          setIsCollapsed(true);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(true)}`;
        }}
        onResize={() => {
          setIsCollapsed(false);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(false)}`;
        }}
      >
        <Nav>
          <NavMain
            isCollapsed={isCollapsed}
            links={[
              {
                title: "Dashboard",
                href: "/admin",
                prefix: <LayoutDashboardIcon />,
              },
            ]}
          />
        </Nav>

        <Separator />

        <Nav>
          <NavMain
            isCollapsed={isCollapsed}
            links={[
              {
                title: "Tools",
                href: "/admin/tools",
                label: stats[0].toString(),
                prefix: <GemIcon />,
              },
              {
                title: "Categories",
                href: "/admin/categories",
                label: stats[1].toString(),
                prefix: <ShapesIcon />,
              },
              {
                title: "Tags",
                href: "/admin/tags",
                label: stats[2].toString(),
                prefix: <TagIcon />,
              },
              {
                title: "Reports",
                href: "/admin/reports",
                // Only open reports need attention, so hide a zero count.
                label: stats[3] ? stats[3].toString() : undefined,
                prefix: <FlagIcon />,
              },
              {
                title: "AI Logs",
                href: "/admin/ai-usage",
                prefix: <MessagesSquareIcon />,
              },
              {
                title: "Users",
                href: "/admin/users",
                prefix: <UsersIcon />,
              },
            ]}
          />
        </Nav>

        <Separator />

        <Nav>
          <NavMain
            isCollapsed={isCollapsed}
            links={[
              {
                title: "Ads",
                href: "/admin/ads",
                prefix: <MegaphoneIcon />,
              },
            ]}
          />
        </Nav>

        <Nav className="mt-auto">
          <NavMain
            isCollapsed={isCollapsed}
            links={[
              {
                title: "Visit Site",
                href: siteConfig.url,
                prefix: <GlobeIcon />,
              },
              {
                title: "Sign Out",
                href: "#",
                onClick: () => signOut(),
                prefix: <LogOutIcon />,
              },
            ]}
          />
        </Nav>
      </ResizablePanel>

      <ResizableHandle
        className="sticky top-0 h-dvh items-start pt-[1.33rem]"
        withHandle={!isMobile}
      />

      <ResizablePanel
        className="grid grid-cols-1 content-start gap-4 p-4 sm:px-6"
        defaultSize={defaultLayout[1]}
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
