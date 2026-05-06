"use client";

import { Slot } from "@radix-ui/react-slot";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  HomeIcon,
  LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname as useCurrentPathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fragment, type HTMLAttributes } from "react";
import { toast } from "sonner";
import { Icon } from "~/components/common/icon";
import { NavItem, type NavItemProps } from "~/components/web/nav-item";
import { Dock, DockItem, DockSeparator } from "~/components/web/ui/dock";
import { Tooltip, TooltipProvider } from "~/components/web/ui/tooltip";
import { config } from "~/config";
import { useRouter } from "~/i18n/navigation";
import type { ToolOne } from "~/server/tools/payloads";
import type { IconName } from "~/types/icons";

type NavProps = HTMLAttributes<HTMLElement> & {
  tool: ToolOne;
  toolName?: string;
  previous?: string;
  next?: string;
};

export const Nav = ({ tool, toolName, previous, next, ...props }: NavProps) => {
  const t = useTranslations("ToolNav");
  const router = useRouter();
  const pathname = useCurrentPathname();
  const currentUrl = `${config.site.url}${pathname}`;

  const shareUrl = encodeURIComponent(currentUrl);
  const shareTitle = encodeURIComponent(
    `${toolName ?? tool.name} — ${config.site.name}`
  );

  const shareOptions: Array<{ platform: string; url: string; icon: IconName }> =
    [
      {
        platform: "X",
        url: `https://x.com/intent/post?text=${shareTitle}&url=${shareUrl}`,
        icon: "brand-x",
      },
      {
        platform: "Facebook",
        url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
        icon: "brand-facebook",
      },
      {
        platform: "LinkedIn",
        url: `https://linkedin.com/sharing/share-offsite?url=${shareUrl}&text=${shareTitle}`,
        icon: "brand-linkedin",
      },
    ];

  const actions: (null | NavItemProps)[] = [
    {
      icon: <HomeIcon />,
      tooltip: t("goHome"),
      shortcut: "H",
      onClick: () => router.push("/"),
    },
    // {
    //   icon: <EraserIcon />,
    //   tooltip: "Request a Change",
    //   shortcut: "R",
    // },
    // {
    //   icon: <HeartIcon />,
    //   tooltip: "Add to favorites",
    //   shortcut: "L",
    //   isActive: isFavorite,
    //   onClick: () => setIsFavorite(!isFavorite),
    // },
    {
      icon: <LinkIcon />,
      tooltip: t("copyLink"),
      shortcut: "C",
      onClick: () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success(t("copied"));
      },
    },
    null,
    {
      icon: <ArrowLeftIcon />,
      tooltip: t("previousTool"),
      shortcut: "←",
      hotkey: "left",
      isDisabled: !previous,
      onClick: () => router.push(`/tools/${previous}`),
    },
    {
      icon: <ArrowRightIcon />,
      tooltip: t("nextTool"),
      shortcut: "→",
      hotkey: "right",
      isDisabled: !next,
      onClick: () => router.push(`/tools/${next}`),
    },
  ];

  return (
    <TooltipProvider delayDuration={0} disableHoverableContent>
      <Dock {...props}>
        {actions.map((action) => (
          <Fragment key={action?.tooltip ?? "separator"}>
            {!action && <DockSeparator />}
            {action && <NavItem {...action} />}
          </Fragment>
        ))}

        <DockSeparator />

        {shareOptions.map(({ platform, url, icon }) => (
          <Tooltip
            key={platform}
            sideOffset={0}
            tooltip={t("shareOn", { platform })}
          >
            <DockItem asChild>
              <Link
                href={url}
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                <Slot className="size-4">
                  <Icon name={icon} />
                </Slot>
              </Link>
            </DockItem>
          </Tooltip>
        ))}
      </Dock>
    </TooltipProvider>
  );
};
