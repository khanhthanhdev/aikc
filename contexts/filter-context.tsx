"use client";

import { useQueryStates, type Values } from "nuqs";
import {
  createContext,
  type PropsWithChildren,
  use,
  useTransition,
} from "react";
import { type SearchMode, searchParams } from "~/server/tools/search-params";

export interface FiltersContextType {
  enableFilters: boolean;
  enableModeToggle: boolean;
  enableSort: boolean;
  filters: Values<typeof searchParams>;
  isLoading: boolean;
  setSearchMode: (mode: SearchMode) => void;
  updateFilters: (values: Partial<Values<typeof searchParams>>) => void;
}

const FiltersContext = createContext<FiltersContextType>(null!);

export interface FiltersProviderProps {
  enableFilters?: boolean;
  enableModeToggle?: boolean;
  enableSort?: boolean;
}

export const FiltersProvider = ({
  children,
  enableSort = true,
  enableFilters = true,
  enableModeToggle = true,
}: PropsWithChildren<FiltersProviderProps>) => {
  const [isLoading, startTransition] = useTransition();

  const [filters, setFilters] = useQueryStates(searchParams, {
    shallow: false,
    throttleMs: 300,
    startTransition,
  });

  const updateFilters = (values: Partial<Values<typeof searchParams>>) => {
    setFilters((prev) => ({ ...prev, ...values, page: null }));
  };

  const setSearchMode = (mode: SearchMode) => {
    updateFilters({ mode });
  };

  return (
    <FiltersContext.Provider
      value={{
        filters,
        isLoading,
        updateFilters,
        setSearchMode,
        enableSort,
        enableFilters,
        enableModeToggle,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = () => {
  const context = use(FiltersContext);

  if (context === undefined) {
    throw new Error("useFilters must be used within a FiltersProvider");
  }

  return context;
};
