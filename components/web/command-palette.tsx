"use client";

import {
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
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/** The cmdk value of the first result, which Enter should open. */
const firstResultValue = (results: PaletteResults) => {
  const [tool] = results.tools;
  if (tool) {
    return `tool:${tool.slug}`;
  }
  const [category] = results.categories;
  if (category) {
    return `category:${category.slug}`;
  }
  const [tag] = results.tags;
  return tag ? `tag:${tag.slug}` : "";
};

const resultValues = (results: PaletteResults) => [
  ...results.tools.map(
    (tool: PaletteResults["tools"][0]) => `tool:${tool.slug}`
  ),
  ...results.categories.map(
    (category: PaletteResults["categories"][0]) => `category:${category.slug}`
  ),
  ...results.tags.map((tag: PaletteResults["tags"][0]) => `tag:${tag.slug}`),
];

const PALETTE_WIDTH = 560;
const PALETTE_GUTTER = 12;
/** Height of the palette's input row, to center it on the header box */
const INPUT_ROW_HEIGHT = 50;

/**
 * Places the palette over the header's search box, so the box seems to open
 * into the results rather than a second search box appearing. Without a
 * visible box (top of the homepage), the palette stays centered.
 */
const useAnchoredPosition = (isOpen: boolean) => {
  const [position, setPosition] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const measure = () => {
      const trigger = [
        ...document.querySelectorAll<HTMLElement>("[data-search-trigger]"),
      ].find(
        (element) =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden"
      );
      if (!trigger) {
        setPosition(undefined);
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.min(PALETTE_WIDTH, viewportWidth - PALETTE_GUTTER * 2);
      const left = Math.min(
        Math.max(rect.left, PALETTE_GUTTER),
        viewportWidth - width - PALETTE_GUTTER
      );
      const top = Math.max(
        rect.top + rect.height / 2 - INPUT_ROW_HEIGHT / 2,
        PALETTE_GUTTER / 2
      );
      setPosition({
        top,
        left,
        width,
        maxHeight: `calc(100dvh - ${top + PALETTE_GUTTER}px)`,
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOpen]);

  return position;
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
  // cmdk keeps a stale highlight when the highlighted item unmounts with no
  // other item left, so new results would arrive with nothing selected
  const [selected, setSelected] = useState("");
  const searchIdRef = useRef(0);
  const position = useAnchoredPosition(palette.isOpen);

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
      setSelected(firstResultValue(data));
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
    setSelected("");
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
      searchIdRef.current++;
      setResults(null);
      setError(null);
      setIsPending(false);
      setSelected("");
    }
  }, [query, executeProgressiveSearch]);

  // Semantic results are merged in after the keyword ones: keep what the
  // visitor highlighted, unless it is gone from the list
  useEffect(() => {
    if (results && !resultValues(results).includes(selected)) {
      setSelected(firstResultValue(results));
    }
  }, [results, selected]);

  const trimmedInput = input.trim();
  const hasQuery = trimmedInput.length > 0;
  // Searching from the first keystroke, through the debounce, to the results
  const isSearching =
    isPending || (trimmedInput.length > 1 && trimmedInput !== query.trim());
  const hasTools = !!results?.tools.length;
  const hasCategories = !!results?.categories.length;
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
    return `tools:${searchModes.tools} • categories:${searchModes.categories} • tags:${searchModes.tags}`;
  }, [results]);

  return (
    <CommandDialog
      onOpenChange={handleOpenChange}
      onValueChange={setSelected}
      open={palette.isOpen}
      position={position}
      shouldFilter={false}
      value={selected}
    >
      <div className="relative">
        <CommandInput
          onValueChange={handleInputChange}
          placeholder={t("inputPlaceholder")}
          value={input}
        />

        <div className="absolute inset-y-0 right-12 flex items-center gap-2 text-muted-foreground">
          {isSearching && (
            <LoaderIcon
              aria-label={t("searching")}
              className="size-4 animate-spin"
            />
          )}
        </div>
      </div>

      <CommandList>
        <CommandEmpty>
          {error
            ? t("searchFailed", { error })
            : isSearching
              ? `${t("searching")}…`
              : trimmedInput.length > 1
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
              const tagline =
                locale === "vi"
                  ? (tool.taglineVi ?? tool.tagline)
                  : tool.tagline;
              // Extract domain from websiteUrl
              const domain = tool.websiteUrl
                ? new URL(tool.websiteUrl).hostname.replace(/^www\./, "")
                : "";

              return (
                <CommandItem
                  className="gap-3 py-2"
                  key={tool.id}
                  onSelect={() => handleSelect(`/tools/${tool.slug}`)}
                  value={`tool:${tool.slug}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-background">
                    {tool.faviconUrl ? (
                      <Favicon
                        className="size-6"
                        src={tool.faviconUrl}
                        title={toolName}
                      />
                    ) : (
                      <WrenchIcon className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{toolName}</span>
                    {(tagline || domain) && (
                      <span className="truncate text-muted-foreground text-xs">
                        {tagline || domain}
                      </span>
                    )}
                  </span>
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

        {hasTags && (
          <>
            {(hasTools || hasCategories) && <CommandSeparator />}
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

        {!hasQuery && (
          <>
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
                  <span className="flex-1 truncate">
                    {t("switchToLightMode")}
                  </span>
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
                  <span className="flex-1 truncate">
                    {t("switchToDarkMode")}
                  </span>
                  <CommandShortcut>⇧⌘L</CommandShortcut>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
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
