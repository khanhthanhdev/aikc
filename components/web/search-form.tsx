"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { HTMLAttributes } from "react";
import { Shortcut } from "~/components/web/ui/shortcut";
import { useCommandPalette } from "~/contexts/command-palette-context";
import { cx } from "~/utils/cva";

export const SearchForm = ({
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement>) => {
  const t = useTranslations("Common");
  const palette = useCommandPalette();

  return (
    <button
      aria-label={t("search")}
      className={cx(
        "flex h-8 w-52 shrink-0 items-center gap-2 rounded-lg border bg-muted/20 px-2.5 text-muted-foreground text-sm transition-colors hover:bg-muted/40 hover:text-foreground max-sm:h-8 max-sm:w-8 max-sm:justify-center max-sm:border-transparent max-sm:bg-transparent max-sm:px-0",
        className
      )}
      onClick={palette.open}
      type="button"
      {...props}
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="whitespace-nowrap max-sm:hidden">
        {t("searchPlaceholder")}
      </span>
      <Shortcut
        className="ml-auto text-muted-foreground/80 text-xs max-sm:hidden"
        size="h6"
      >
        ⌘K
      </Shortcut>
    </button>
  );
};
