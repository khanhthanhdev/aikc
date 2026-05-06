"use client";

import { getUrlHostname } from "@curiousleaf/utils";
import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Button } from "~/components/web/ui/button";
import type { ToolOne } from "~/server/tools/payloads";

type ToolLinkProps = ComponentProps<typeof Button> & {
  tool: ToolOne;
};

export const ToolLink = ({ tool, ...props }: ToolLinkProps) => {
  const t = useTranslations("Tools");

  return (
    <Button asChild suffix={<ArrowUpRightIcon />} {...props}>
      <a
        href={tool.affiliateUrl || tool.websiteUrl}
        rel={`noreferrer noopener ${tool.isFeatured ? "" : "nofollow"}`}
        target="_blank"
      >
        <span className="sm:hidden">{t("visit")}</span>
        <span className="max-sm:hidden">{getUrlHostname(tool.websiteUrl)}</span>
      </a>
    </Button>
  );
};
