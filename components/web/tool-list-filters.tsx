"use client";

import { LoaderIcon, SearchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates, type Values } from "nuqs";
import { useEffect, useState, useTransition } from "react";
import { Stack } from "~/components/common/stack";
import { Input } from "~/components/web/ui/input";
import { Select } from "~/components/web/ui/select";
import { useDebounce } from "~/hooks/use-debounce";
import type { CategoryMany } from "~/server/categories/payloads";
import { searchParams } from "~/server/tools/search-params";

export interface ToolListFiltersProps {
  categories?: CategoryMany[];
  placeholder?: string;
}

export const ToolListFilters = ({
  categories,
  placeholder,
}: ToolListFiltersProps) => {
  const t = useTranslations("Filters");
  const locale = useLocale();
  const [isLoading, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(searchParams, {
    shallow: false,
    startTransition,
  });
  const [inputValue, setInputValue] = useState(filters.q || "");
  const q = useDebounce(inputValue, 300);

  const updateFilters = (values: Partial<Values<typeof searchParams>>) => {
    setFilters({ ...values, page: null });
  };

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      q: q || null,
      page: q && q !== prev.q ? null : prev.page,
    }));
  }, [q, setFilters]);

  useEffect(() => {
    setInputValue(filters.q || "");
  }, [filters]);

  const sortOptions = [
    { value: "publishedAt.desc", label: t("sortNewest") },
    { value: "publishedAt.asc", label: t("sortOldest") },
    { value: "name.asc", label: t("sortNameAsc") },
    { value: "name.desc", label: t("sortNameDesc") },
  ];

  const pricingOptions = [
    { value: "free", label: t("pricingFree") },
    { value: "freemium", label: t("pricingFreemium") },
    { value: "paid", label: t("pricingPaid") },
  ];

  return (
    <Stack className="w-full">
      <div className="relative min-w-0 grow">
        <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 opacity-50">
          {isLoading ? <LoaderIcon className="animate-spin" /> : <SearchIcon />}
        </div>

        <Input
          className="w-full truncate pl-10"
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder || t("searchPlaceholder")}
          size="lg"
          value={inputValue}
        />
      </div>

      {categories && (
        <Select
          aria-label={t("filterByCategory")}
          className="min-w-40 max-sm:flex-1"
          onChange={(e) => updateFilters({ category: e.target.value })}
          size="lg"
          value={filters.category}
        >
          <option value="">{t("allCategories")}</option>

          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {locale === "vi"
                ? (category.labelVi ??
                  category.label ??
                  category.nameVi ??
                  category.name)
                : (category.label ?? category.name)}
            </option>
          ))}
        </Select>
      )}

      <Select
        aria-label={t("filterByPricing")}
        className="min-w-36 max-sm:flex-1"
        onChange={(e) => updateFilters({ pricing: e.target.value })}
        size="lg"
        value={filters.pricing}
      >
        <option value="">{t("allPricing")}</option>

        {pricingOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("sortBy")}
        className="min-w-36 max-sm:flex-1"
        onChange={(e) => updateFilters({ sort: e.target.value })}
        size="lg"
        value={filters.sort}
      >
        <option disabled value="">
          {t("orderBy")}
        </option>

        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Stack>
  );
};
