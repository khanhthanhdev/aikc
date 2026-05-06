"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { Badge } from "~/components/admin/ui/badge";
import { Button, type ButtonProps } from "~/components/admin/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/admin/ui/tooltip";

type NavMainLink = ButtonProps & {
  title: string;
  href: string;
  label?: ReactNode;
};

type NavMainProps = ComponentProps<"nav"> & {
  isCollapsed: boolean;
  links: NavMainLink[];
};

export const NavMain = ({
  className,
  links,
  isCollapsed,
  ...props
}: NavMainProps) => {
  const pathname = usePathname();
  const rootPath = "/admin";

  const getButtonVariant = (href: string) => {
    if (
      (href === rootPath && href === pathname) ||
      (href !== rootPath && pathname.startsWith(href))
    ) {
      return "secondary";
    }

    return "ghost";
  };

  return (
    <>
      {links.map(({ href, title, label, ...props }, index) =>
        isCollapsed ? (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                aria-label={title}
                asChild
                size="sm"
                variant={getButtonVariant(href)}
                {...props}
              >
                <Link href={href} />
              </Button>
            </TooltipTrigger>

            <TooltipContent className="flex items-center gap-4" side="right">
              {title}
              {label && <span className="opacity-60">{label}</span>}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            asChild
            className="justify-start"
            key={index}
            suffix={
              label && (
                <Badge className="ml-auto size-auto px-1.5" variant="outline">
                  {label}
                </Badge>
              )
            }
            variant={getButtonVariant(href)}
            {...props}
          >
            <Link href={href}>{title}</Link>
          </Button>
        )
      )}
    </>
  );
};
