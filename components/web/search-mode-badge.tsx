import { HashIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SearchMode } from "~/actions/search";

interface SearchModeBadgeProps {
  compact?: boolean;
  mode: SearchMode;
}

export const SearchModeBadge = ({
  mode,
  compact = false,
}: SearchModeBadgeProps) => {
  const t = useTranslations("SearchProgress");

  if (mode === "keyword") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 text-xs dark:bg-blue-900/30 dark:text-blue-400 ${
          compact ? "" : "px-2.5 py-1"
        }`}
      >
        <HashIcon className="size-3" />
        {!compact && t("keyword")}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-700 text-xs dark:bg-purple-900/30 dark:text-purple-400 ${
        compact ? "" : "px-2.5 py-1"
      }`}
    >
      <SparklesIcon className="size-3" />
      {!compact && t("semantic")}
    </span>
  );
};
