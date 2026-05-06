"use client";

import {
  BookmarkIcon,
  FolderIcon,
  HashIcon,
  LoaderIcon,
  MoonIcon,
  SparkleIcon,
  SunIcon,
  TagIcon,
  WrenchIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { inferServerActionReturnData } from "zsa";
import {
  keywordSearchPaletteItems,
  searchPaletteItems,
} from "~/actions/search";
import { SearchStatusFooter } from "~/components/web/search-status-footer";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/web/ui/command";
import { Favicon } from "~/components/web/ui/favicon";
import { Shortcut } from "~/components/web/ui/shortcut";
import { useCommandPalette } from "~/contexts/command-palette-context";
import { useDebouncedState } from "~/hooks/use-debounced-state";
import { useRouter } from "~/i18n/navigation";

type PaletteResults = inferServerActionReturnData<typeof searchPaletteItems>;

type ProgressiveResults = PaletteResults & {
  isWaitingForSemantic: boolean;
  semanticComplete: boolean;
};

const mergeSemanticResults = (
  prev: ProgressiveResults,
  semanticResult: PaletteResults
): ProgressiveResults => {
  type Tool = PaletteResults["tools"][0];
  type Category = PaletteResults["categories"][0];

  const semanticToolIds = new Set(semanticResult.tools.map((t: Tool) => t.id));
  const mergedTools = [
    ...semanticResult.tools,
    ...prev.tools.filter((tool: Tool) => !semanticToolIds.has(tool.id)),
  ];

  const semanticCategoryIds = new Set(
    semanticResult.categories.map((c: Category) => c.id)
  );
  const mergedCategories = [
    ...semanticResult.categories,
    ...prev.categories.filter(
      (cat: Category) => !semanticCategoryIds.has(cat.id)
    ),
  ];

  return {
    ...prev,
    tools: mergedTools,
    categories: mergedCategories,
    matches: semanticResult.matches,
    categoryMatches: semanticResult.categoryMatches,
    searchModes: semanticResult.searchModes,
    elapsedMs: semanticResult.elapsedMs,
    semanticComplete: true,
    isWaitingForSemantic: false,
  };
};

const shouldIgnoreHotkeyTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  const editable = target.getAttribute("contenteditable");
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    editable === "true" ||
    target.isContentEditable
  );
};

export const CommandPalette = () => {
  const t = useTranslations("CommandPalette");
  const locale = useLocale();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const palette = useCommandPalette();
  const [input, setInput] = useState("");
  const [query, setQuery] = useDebouncedState("", 300);
  const [results, setResults] = useState<ProgressiveResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const searchIdRef = useRef(0);

  const handleKeywordResults = useCallback(
    async (
      promise: ReturnType<typeof keywordSearchPaletteItems>,
      searchId: number
    ) => {
      const [data, err] = await promise;
      if (searchIdRef.current !== searchId) {
        return false;
      }
      if (err) {
        throw new Error(err.message);
      }
      setResults({
        ...data,
        semanticComplete: false,
        isWaitingForSemantic: true,
      });
      setIsPending(false);
      return true;
    },
    []
  );

  const handleSemanticResults = useCallback(
    async (
      promise: ReturnType<typeof searchPaletteItems>,
      searchId: number
    ) => {
      const [data, err] = await promise;
      if (searchIdRef.current !== searchId) {
        return;
      }
      if (err || !data) {
        throw new Error(err?.message ?? "Semantic search failed");
      }
      setResults((prev: ProgressiveResults | null) =>
        prev
          ? mergeSemanticResults(prev, data)
          : {
              ...data,
              semanticComplete: true,
              isWaitingForSemantic: false,
            }
      );
    },
    []
  );

  const executeProgressiveSearch = useCallback(
    async (q: string) => {
      const currentSearchId = ++searchIdRef.current;
      setIsPending(true);
      setError(null);

      const keywordPromise = keywordSearchPaletteItems({ q });
      const semanticPromise = searchPaletteItems({ q, mode: "semantic" });

      try {
        await handleKeywordResults(keywordPromise, currentSearchId);
      } catch (err) {
        if (searchIdRef.current !== currentSearchId) {
          return;
        }
        setError(
          err instanceof Error ? err.message : t("searchFailedFallback")
        );
        setIsPending(false);
        return;
      }

      try {
        await handleSemanticResults(semanticPromise, currentSearchId);
      } catch {
        if (searchIdRef.current !== currentSearchId) {
          return;
        }
        setResults((prev: ProgressiveResults | null) =>
          prev
            ? { ...prev, semanticComplete: true, isWaitingForSemantic: false }
            : prev
        );
      }
    },
    [t, handleKeywordResults, handleSemanticResults]
  );

  const clearState = useCallback(() => {
    setInput("");
    setResults(null);
    setError(null);
    searchIdRef.current++;
  }, []);

  const handleClose = useCallback(() => {
    palette.close();
    clearState();
  }, [clearState, palette]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        palette.open();
      } else {
        handleClose();
      }
    },
    [handleClose, palette]
  );

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href);
      handleClose();
    },
    [handleClose, router]
  );
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      setQuery(value);
    },
    [setQuery]
  );

  // Keyboard shortcut: Mod+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Allow closing even when focused on input
        if (palette.isOpen) {
          e.preventDefault();
          handleClose();
        } else if (!shouldIgnoreHotkeyTarget(e.target)) {
          e.preventDefault();
          palette.open();
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [palette.isOpen, palette.open, handleClose]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length > 1) {
      executeProgressiveSearch(trimmed);
    } else {
      setResults(null);
      setError(null);
    }
  }, [query, executeProgressiveSearch]);

  const hasQuery = input.trim().length > 0;
  const _totalHits = results
    ? results.tools.length +
      results.categories.length +
      results.collections.length +
      results.tags.length
    : 0;
  const hasTools = !!results?.tools.length;
  const hasCategories = !!results?.categories.length;
  const hasCollections = !!results?.collections.length;
  const hasTags = !!results?.tags.length;
  const quickLinks = [
    { label: t("quickTools"), href: "/", icon: WrenchIcon },
    { label: t("quickCategories"), href: "/categories", icon: FolderIcon },
    { label: t("quickTags"), href: "/tags", icon: TagIcon },
    { label: t("quickSubmit"), href: "/submit", icon: SparkleIcon },
  ];

  const _fallbackNotice =
    results?.requestedMode === "semantic" &&
    ["tools", "categories"].some(
      (key) =>
        results?.searchModes[key as keyof PaletteResults["searchModes"]] ===
        "keyword"
    );

  const _modeSummary = useMemo(() => {
    if (!results) {
      return "";
    }
    const { searchModes } = results;
    return `tools:${searchModes.tools} • categories:${searchModes.categories} • collections:${searchModes.collections} • tags:${searchModes.tags}`;
  }, [results]);

  return (
    <CommandDialog
      onOpenChange={handleOpenChange}
      open={palette.isOpen}
      shouldFilter={false}
    >
      <div className="relative">
        <CommandInput
          onValueChange={handleInputChange}
          placeholder={t("inputPlaceholder")}
          value={input}
        />

        <div className="absolute inset-y-0 right-3 flex items-center gap-2 text-muted-foreground">
          {isPending && (
            <LoaderIcon
              aria-label={t("searching")}
              className="size-4 animate-spin"
            />
          )}
          <Shortcut className="text-muted-foreground/80 text-xs" size="h6" />
        </div>
      </div>

      <CommandList>
        <CommandEmpty>
          {error
            ? t("searchFailed", { error })
            : hasQuery
              ? t("noResults")
              : t("emptyPrompt")}
        </CommandEmpty>

        {!hasQuery && (
          <CommandGroup heading={t("quickLinksHeading")}>
            {quickLinks.map((link) => (
              <CommandItem
                key={link.href}
                onSelect={() => handleSelect(link.href)}
              >
                <link.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{link.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasTools && (
          <CommandGroup heading={t("toolsHeading")}>
            {results.tools.map((tool: PaletteResults["tools"][0]) => {
              const toolName =
                locale === "vi" ? (tool.nameVi ?? tool.name) : tool.name;
              // Extract domain from websiteUrl
              const domain = tool.websiteUrl
                ? new URL(tool.websiteUrl).hostname.replace(/^www\./, "")
                : "";

              return (
                <CommandItem
                  className="flex items-center justify-between gap-3"
                  key={tool.id}
                  onSelect={() => handleSelect(`/tools/${tool.slug}`)}
                  value={`tool:${tool.slug}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {tool.faviconUrl ? (
                      <Favicon
                        className="size-5 shrink-0"
                        src={tool.faviconUrl}
                        title={toolName}
                      />
                    ) : (
                      <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">{toolName}</span>
                  </div>
                  {domain && (
                    <span className="shrink-0 text-muted-foreground text-sm">
                      {domain}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {hasCategories && (
          <>
            {hasTools && <CommandSeparator />}
            <CommandGroup heading={t("categoriesHeading")}>
              {results.categories.map(
                (category: PaletteResults["categories"][0]) => (
                  <CommandItem
                    key={category.id}
                    onSelect={() =>
                      handleSelect(`/categories/${category.slug}`)
                    }
                    value={`category:${category.slug}`}
                  >
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      {locale === "vi"
                        ? (category.labelVi ??
                          category.label ??
                          category.nameVi ??
                          category.name)
                        : (category.label ?? category.name)}
                    </span>
                  </CommandItem>
                )
              )}
            </CommandGroup>
          </>
        )}

        {hasCollections && (
          <>
            {(hasTools || hasCategories) && <CommandSeparator />}
            <CommandGroup heading={t("collectionsHeading")}>
              {results.collections.map(
                (collection: PaletteResults["collections"][0]) => (
                  <CommandItem
                    key={collection.id}
                    onSelect={() =>
                      handleSelect(`/collections/${collection.slug}`)
                    }
                    value={`collection:${collection.slug}`}
                  >
                    <BookmarkIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      {locale === "vi"
                        ? (collection.nameVi ?? collection.name)
                        : collection.name}
                    </span>
                  </CommandItem>
                )
              )}
            </CommandGroup>
          </>
        )}

        {hasTags && (
          <>
            {(hasTools || hasCategories || hasCollections) && (
              <CommandSeparator />
            )}
            <CommandGroup heading={t("tagsHeading")}>
              {results.tags.map((tag: PaletteResults["tags"][0]) => (
                <CommandItem
                  key={tag.id}
                  onSelect={() => handleSelect(`/tags/${tag.slug}`)}
                  value={`tag:${tag.slug}`}
                >
                  <HashIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {locale === "vi" ? (tag.nameVi ?? tag.name) : tag.name}
                  </span>
                  <CommandShortcut>{t("tagShortcut")}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading={t("appearanceHeading")}>
          {resolvedTheme === "dark" ? (
            <CommandItem
              onSelect={() => {
                setTheme("light");
                handleClose();
              }}
            >
              <SunIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{t("switchToLightMode")}</span>
              <CommandShortcut>⇧⌘L</CommandShortcut>
            </CommandItem>
          ) : (
            <CommandItem
              onSelect={() => {
                setTheme("dark");
                handleClose();
              }}
            >
              <MoonIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{t("switchToDarkMode")}</span>
              <CommandShortcut>⇧⌘L</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      {results && (
        <SearchStatusFooter
          elapsedMs={results.elapsedMs}
          isWaitingForSemantic={results.isWaitingForSemantic}
          searchModes={results.searchModes}
          semanticComplete={results.semanticComplete}
        />
      )}
    </CommandDialog>
  );
};
