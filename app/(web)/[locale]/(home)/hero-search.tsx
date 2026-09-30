"use client";

import {
  FolderIcon,
  HistoryIcon,
  LoaderIcon,
  type LucideIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { type SearchSuggestions, suggestSearchItems } from "~/actions/search";
import { useChatContext } from "~/components/web/ai-chat/chat-context";
import { useRole } from "~/components/web/roles/role-context";
import { FaviconImage } from "~/components/web/ui/favicon";
import { HOME_ELEMENT_IDS } from "~/config/home";
import { useDebounce } from "~/hooks/use-debounce";
import { useRouter } from "~/i18n/navigation";
import { searchParams } from "~/server/tools/search-params";
import { cx } from "~/utils/cva";
import { getShownElementById } from "~/utils/helpers";

/** Suggestions start from this many characters, like the server action. */
const MIN_SUGGEST_LENGTH = 2;
const SUGGEST_DEBOUNCE_MS = 150;
/** How often the example in the placeholder changes. */
const PLACEHOLDER_INTERVAL_MS = 3500;

export const HeroSearch = () => {
  const t = useTranslations("Home");
  const tRoles = useTranslations("Roles");
  const locale = useLocale();
  const router = useRouter();
  const { askQuestion, setIsOpen } = useChatContext();
  const { role } = useRole();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isSearching, startTransition] = useTransition();
  const [{ q }, setFilters] = useQueryStates(searchParams, {
    shallow: false,
    startTransition,
  });

  const [value, setValue] = useState(q ?? "");
  const [isOpen, setIsOpenList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY);
  const [suggestedFor, setSuggestedFor] = useState("");
  const debounced = useDebounce(value.trim(), SUGGEST_DEBOUNCE_MS);
  const [recent, setRecent] = useState<string[]>([]);
  const [exampleIndex, setExampleIndex] = useState(0);
  // The role is only known after hydration; the examples wait for it
  const [isMounted, setIsMounted] = useState(false);

  // Searches worth trying, for the visitor's role when we know it
  const examples = (
    role ? tRoles.raw(`${role}.searches`) : t.raw("searchDefaults")
  ) as string[];

  useEffect(() => {
    setIsMounted(true);
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    const timer = setInterval(
      () => setExampleIndex((index) => index + 1),
      PLACEHOLDER_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, []);

  // Keep the box in step with the URL, e.g. when the search is cleared below
  useEffect(() => {
    setValue(q ?? "");
  }, [q]);

  useEffect(() => {
    if (debounced.length < MIN_SUGGEST_LENGTH) {
      setSuggestions(EMPTY);
      setSuggestedFor("");
      return;
    }

    // Answers can arrive out of order; only the latest one counts
    let isCurrent = true;
    // zsa's types do not carry through with this zod version, hence the cast
    const request = suggestSearchItems({ q: debounced }) as Promise<
      [SearchSuggestions | null, unknown]
    >;
    request
      .catch(() => [null, null] as const)
      .then(([data]) => {
        if (isCurrent) {
          setSuggestions(data ?? EMPTY);
          setSuggestedFor(debounced);
          setActiveIndex(-1);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [debounced]);

  const pick = (en: string, vi: string | null) =>
    locale === "vi" && vi ? vi : en;

  const trimmed = value.trim();
  const isEmpty = trimmed.length < MIN_SUGGEST_LENGTH;

  // An empty box offers the visitor's own recent searches; a typed one, what
  // matches it
  const items: Item[] = isEmpty
    ? recent.map((query) => ({
        key: `recent-${query}`,
        label: query,
        query,
        icon: HistoryIcon,
        group: t("searchRecent"),
      }))
    : [
        ...suggestions.tools.map((tool) => ({
          key: `tool-${tool.slug}`,
          href: `/tools/${tool.slug}`,
          label: pick(tool.name, tool.nameVi),
          detail: pick(tool.tagline ?? "", tool.taglineVi),
          faviconUrl: tool.faviconUrl,
        })),
        ...suggestions.categories.map((category) => ({
          key: `category-${category.slug}`,
          href: `/categories/${category.slug}`,
          label:
            locale === "vi"
              ? (category.labelVi ??
                category.label ??
                category.nameVi ??
                category.name)
              : (category.label ?? category.name),
          icon: FolderIcon,
          badge: t("searchCategory"),
        })),
      ];

  const showList =
    isOpen && items.length > 0 && (isEmpty || suggestedFor === trimmed);

  const close = () => {
    setIsOpenList(false);
    setActiveIndex(-1);
  };

  const search = (query = trimmed) => {
    close();
    setValue(query);
    setFilters({ q: query || null, page: null });
    if (query) {
      setRecent(saveRecent(query));
    }
    getShownElementById(HOME_ELEMENT_IDS.tools)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const open = (item: Item) => {
    if (item.query !== undefined) {
      search(item.query);
      return;
    }
    close();
    if (item.href) {
      router.push(item.href);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const item = showList ? items[activeIndex] : undefined;

    if (item) {
      open(item);
    } else {
      search();
    }
  };

  const handleAskAi = () => {
    close();
    if (trimmed) {
      askQuestion(trimmed);
    } else {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      close();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    if (!showList) {
      setIsOpenList(true);
      return;
    }

    const step = event.key === "ArrowDown" ? 1 : -1;
    // -1 is the box itself: one step past either end goes back to typing
    setActiveIndex((index) => {
      const next = index + step;
      if (next < -1) {
        return items.length - 1;
      }
      return next >= items.length ? -1 : next;
    });
  };

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-3">
      <form className="relative w-full" onSubmit={handleSubmit} role="search">
        <div className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background p-1.5 pl-4 shadow-sm transition focus-within:border-foreground/30 focus-within:shadow-md focus-within:ring-[3px] focus-within:ring-foreground/10">
          {isSearching ? (
            <LoaderIcon className="size-5 shrink-0 animate-spin opacity-50" />
          ) : (
            <SearchIcon className="size-5 shrink-0 opacity-50" />
          )}

          <input
            aria-activedescendant={
              showList && activeIndex >= 0
                ? `${listboxId}-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showList}
            aria-label={t("searchLabel")}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 truncate bg-transparent text-base text-foreground outline-none placeholder:text-foreground/45"
            enterKeyHint="search"
            onBlur={close}
            onChange={(event) => {
              setValue(event.target.value);
              setActiveIndex(-1);
              setIsOpenList(true);
            }}
            onClick={() => setIsOpenList(true)}
            onFocus={() => setIsOpenList(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("searchPlaceholder", {
              example: examples[exampleIndex % examples.length] ?? "",
            })}
            ref={inputRef}
            role="combobox"
            type="text"
            value={value}
          />

          {value && (
            <button
              aria-label={t("searchClear")}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
                if (q) {
                  setFilters({ q: null, page: null });
                }
              }}
              type="button"
            >
              <XIcon className="size-4" />
            </button>
          )}

          <button
            aria-label={t("askAi")}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-foreground/20 px-3 font-display font-semibold text-sm transition-colors hover:border-foreground/40 hover:bg-foreground/5 sm:px-4"
            onClick={handleAskAi}
            type="button"
          >
            <SparklesIcon className="size-4" />
            <span className="max-sm:hidden">{t("askAi")}</span>
          </button>

          <button
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-foreground px-4 font-display font-semibold text-background text-sm opacity-90 transition-opacity hover:opacity-100 sm:px-5"
            type="submit"
          >
            {t("searchButton")}
          </button>
        </div>

        {showList && (
          <div
            className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(26rem,60vh)] overflow-y-auto rounded-2xl border border-foreground/10 bg-background py-1.5 text-start shadow-lg"
            id={listboxId}
            // Keep focus in the box, so a click on an item is not a blur first
            onMouseDown={(event) => event.preventDefault()}
            role="listbox"
          >
            {items.map((item, index) => (
              <div key={item.key}>
                {item.group && item.group !== items[index - 1]?.group && (
                  <p
                    className="px-4 pt-2 pb-1 font-medium text-foreground/50 text-xs"
                    role="presentation"
                  >
                    {item.group}
                  </p>
                )}

                <button
                  aria-selected={index === activeIndex}
                  className={cx(
                    "flex w-full items-center gap-3 px-4 py-2 text-start text-sm",
                    index === activeIndex
                      ? "bg-foreground/[0.06]"
                      : "hover:bg-foreground/[0.04]"
                  )}
                  id={`${listboxId}-${index}`}
                  onClick={() => open(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  tabIndex={-1}
                  type="button"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/5">
                    {item.icon ? (
                      <item.icon className="size-3.5 opacity-60" />
                    ) : (
                      <FaviconImage
                        className="size-full"
                        src={item.faviconUrl ?? null}
                        title={item.label}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{item.label}</span>
                    {item.detail && (
                      <span className="text-foreground/55">
                        {" "}
                        · {item.detail}
                      </span>
                    )}
                  </span>
                  {item.badge && (
                    <span className="shrink-0 text-foreground/45 text-xs">
                      {item.badge}
                    </span>
                  )}
                </button>
              </div>
            ))}

            <div className="mt-1 border-foreground/10 border-t px-4 pt-2 pb-1">
              {isEmpty ? (
                <button
                  className="text-foreground/55 text-xs hover:text-foreground"
                  onClick={() => {
                    clearRecent();
                    setRecent([]);
                  }}
                  tabIndex={-1}
                  type="button"
                >
                  {t("searchClearHistory")}
                </button>
              ) : (
                <button
                  className="flex w-full items-center gap-3 py-1 text-start text-foreground/70 text-sm hover:text-foreground"
                  onClick={() => search()}
                  tabIndex={-1}
                  type="button"
                >
                  <SearchIcon className="size-4 shrink-0" />
                  <span className="truncate">
                    {t("searchAllFor", { query: trimmed })}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Ideas to start from; kept in place while the role loads, so nothing jumps */}
      <div
        className={cx(
          "flex min-h-7 flex-wrap items-center justify-center gap-1.5 transition-opacity duration-300",
          isMounted ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="text-foreground/50 text-sm">{t("searchTry")}</span>
        {examples.map((example) => (
          <button
            className="rounded-full border border-foreground/15 px-3 py-1 text-foreground/75 text-xs transition-colors hover:border-foreground/30 hover:bg-foreground/5 hover:text-foreground sm:text-sm"
            key={example}
            onClick={() => search(example)}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
};

type Item = {
  key: string;
  label: string;
  /** Where the item leads, or the search it runs. */
  href?: string;
  query?: string;
  detail?: string;
  /** Tools show their favicon; everything else an icon. */
  faviconUrl?: string | null;
  icon?: LucideIcon;
  /** Heading shown above the first item of each group. */
  group?: string;
  badge?: string;
};

const EMPTY: SearchSuggestions = { tools: [], categories: [] };

/**
 * The visitor's last searches, kept in their own browser only. Storage can be
 * missing or blocked (private windows), which just means no history.
 */
const RECENT_KEY = "aikc-recent-searches";
const RECENT_LIMIT = 5;

const readRecent = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_KEY) ?? "[]"
    );
    return Array.isArray(parsed)
      ? parsed
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
};

/** Put a search first in the history, and return the new history. */
const saveRecent = (query: string): string[] => {
  const next = [
    query,
    ...readRecent().filter(
      (entry) => entry.toLowerCase() !== query.toLowerCase()
    ),
  ].slice(0, RECENT_LIMIT);

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Not saved; the history just stays as it was
  }
  return next;
};

const clearRecent = () => {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Nothing to clear
  }
};
