import { useTranslations } from "next-intl";
import type { SearchMode } from "~/actions/search";
import { SearchModeBadge } from "./search-mode-badge";
import { SearchProgressIndicator } from "./search-progress-indicator";

interface SearchStatusFooterProps {
  elapsedMs: number;
  isWaitingForSemantic: boolean;
  searchModes: {
    tools: SearchMode;
    categories: SearchMode;
    collections: SearchMode;
    tags: SearchMode;
  };
  semanticComplete: boolean;
}

export const SearchStatusFooter = ({
  elapsedMs,
  isWaitingForSemantic,
  semanticComplete,
  searchModes,
}: SearchStatusFooterProps) => {
  const t = useTranslations("SearchProgress");

  const formatTime = (ms: number) => {
    if (ms < 100) {
      return "<100ms";
    }
    return `${ms}ms`;
  };

  return (
    <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <SearchProgressIndicator
          isWaitingForSemantic={isWaitingForSemantic}
          semanticComplete={semanticComplete}
        />
        {!isWaitingForSemantic && (
          <span className="text-muted-foreground">
            {semanticComplete ? t("searchComplete") : t("initialResults")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{formatTime(elapsedMs)}</span>
        <SearchModeBadge compact mode={searchModes.tools} />
      </div>
    </div>
  );
};
