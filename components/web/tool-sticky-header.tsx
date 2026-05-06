"use client";

import { useEffect, useRef, useState } from "react";
import { ToolLink } from "~/app/(web)/[locale]/tools/[slug]/tool-link";
import { Box } from "~/components/common/box";
import { Stack } from "~/components/common/stack";
import { ReportToolDialog } from "~/components/web/dialogs/report-tool-dialog";
import { Container } from "~/components/web/ui/container";
import { FaviconImage } from "~/components/web/ui/favicon";
import type { ToolOne } from "~/server/tools/payloads";
import { cx } from "~/utils/cva";

interface ToolStickyHeaderProps {
  tool: ToolOne;
  toolName: string;
  toolTagline: string | null;
}

export const ToolStickyHeader = ({
  tool,
  toolName,
  toolTagline,
}: ToolStickyHeaderProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const relatedToolsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const showThreshold = 300;

          // Get target sections
          if (!relatedToolsRef.current) {
            relatedToolsRef.current = document.getElementById(
              "related-tools-section"
            );
          }
          const tagsSection = document.getElementById("tool-tags-section");

          let shouldShow = scrollY > showThreshold;

          // Check overlap/proximity with Tags section
          if (tagsSection) {
            const rect = tagsSection.getBoundingClientRect();
            // Hide if the tags section is entering the view near the header (e.g. within 100px of header bottom)
            // or effectively if it's "scrolled to". rect.top represents distance from viewport top.
            // If rect.top is small (e.g. < windowHeight/2 or < 200), we act.
            // Adjust threshold as needed. Let's say if it's near the top 150px.
            if (rect.top < 150) {
              shouldShow = false;
            }
          }

          // Check overlap/proximity with Related Tools (fallback if no tags or scrolled past tags)
          if (shouldShow && relatedToolsRef.current) {
            const rect = relatedToolsRef.current.getBoundingClientRect();
            if (rect.top < 150) {
              shouldShow = false;
            }
          }

          setIsVisible(shouldShow);
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Container
      className={cx(
        "fixed top-[calc(var(--header-top)+var(--header-height)+8px)] left-1/2 z-30 -translate-x-1/2",
        "transform transition-all duration-300 ease-in-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-4 opacity-0"
      )}
    >
      <Box>
        <div className="-mx-2 flex items-center justify-between gap-4 rounded-xl bg-background/80 px-4 py-2 backdrop-blur-md lg:-mx-4">
          <Stack size="lg">
            {tool.faviconUrl && (
              <FaviconImage
                className="size-8 rounded-md"
                src={tool.faviconUrl}
                title={toolName}
              />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-snug">
                {toolName}
              </span>
              {toolTagline && (
                <span className="max-w-md truncate text-foreground/60 text-xs max-sm:hidden">
                  {toolTagline}
                </span>
              )}
            </div>
          </Stack>

          <Stack className="items-stretch" size="sm">
            <ReportToolDialog toolId={tool.id} toolName={toolName} />
            <ToolLink size="sm" tool={tool} variant="primary" />
          </Stack>
        </div>
      </Box>
    </Container>
  );
};
