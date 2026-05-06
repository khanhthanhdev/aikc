import { LoaderIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface SearchProgressIndicatorProps {
  isWaitingForSemantic: boolean;
  semanticComplete: boolean;
}

export const SearchProgressIndicator = ({
  isWaitingForSemantic,
  semanticComplete,
}: SearchProgressIndicatorProps) => {
  const t = useTranslations("SearchProgress");

  if (semanticComplete || !isWaitingForSemantic) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <LoaderIcon className="size-3 animate-spin text-purple-500" />
      <span className="flex items-center gap-1">
        <SparklesIcon className="size-3 text-purple-500" />
        {t("loadingSemantic")}
      </span>
    </div>
  );
};
