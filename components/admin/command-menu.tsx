"use client";

import type { Category, Collection, Tag, Tool } from "@prisma/client";
import { LoaderIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { updateFaviconUrls } from "~/actions/misc";
import { searchItems } from "~/actions/search";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/admin/ui/command";
import { useDebouncedState } from "~/hooks/use-debounced-state";

interface SearchResult {
  categories: Category[];
  collections: Collection[];
  tags: Tag[];
  tools: Tool[];
}

export const CommandMenu = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useDebouncedState("", 250);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);

  const clearSearch = () => {
    setTimeout(() => {
      setSearchResults(null);
      setSearchQuery("");
    }, 250);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => {
          if (!open) {
            return true;
          }

          // Clear search results
          clearSearch();
          return false;
        });
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [
    // Clear search results
    clearSearch,
  ]);

  const { execute, isPending } = useServerAction(searchItems, {
    onSuccess: ({ data }) => {
      setSearchResults(data);
    },

    onError: ({ err }) => {
      if (process.env.NODE_ENV === "development") {
        console.error(err);
      }
      setSearchResults(null);
    },
  });

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length > 1) {
        execute({ q: searchQuery });
      } else {
        setSearchResults(null);
      }
    };

    performSearch();
  }, [searchQuery, execute]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);

    // Clear search results
    !newOpen && clearSearch();
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleUpdateFaviconUrls = () => {
    updateFaviconUrls();
    toast.success("Favicon URLs updated");
  };

  const handleSelect = (url: string) => {
    handleOpenChange(false);
    router.push(url);
  };

  return (
    <CommandDialog
      onOpenChange={handleOpenChange}
      open={open}
      shouldFilter={!searchResults}
    >
      <CommandInput
        onValueChange={handleSearch}
        placeholder="Type to search..."
      />

      {isPending && (
        <div className="absolute top-4 left-3 bg-background text-muted-foreground">
          <LoaderIcon className="size-4 animate-spin" />
        </div>
      )}

      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Create">
          <CommandItem onSelect={() => handleSelect("/admin/tools/new")}>
            New Tool
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/admin/categories/new")}>
            New Category
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/admin/collections/new")}>
            New Collection
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/admin/tags/new")}>
            New Tag
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Quick Commands">
          <CommandItem onSelect={handleUpdateFaviconUrls}>
            Update Favicon URLs
          </CommandItem>
        </CommandGroup>

        {!!searchResults?.tools.length && (
          <CommandGroup heading="Tools">
            {searchResults.tools.map((tool) => (
              <CommandItem
                key={tool.id}
                onSelect={() => handleSelect(`/admin/tools/${tool.slug}`)}
                value={`tool:${tool.slug}`}
              >
                {tool.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!searchResults?.categories.length && (
          <CommandGroup heading="Categories">
            {searchResults.categories.map((category) => (
              <CommandItem
                key={category.id}
                onSelect={() =>
                  handleSelect(`/admin/categories/${category.slug}`)
                }
              >
                {category.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!searchResults?.collections.length && (
          <CommandGroup heading="Collections">
            {searchResults.collections.map((collection) => (
              <CommandItem
                key={collection.id}
                onSelect={() =>
                  handleSelect(`/admin/collections/${collection.slug}`)
                }
                value={`collection:${collection.name}`}
              >
                {collection.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!searchResults?.tags.length && (
          <CommandGroup heading="Tags">
            {searchResults.tags.map((tag) => (
              <CommandItem
                key={tag.id}
                onSelect={() => handleSelect(`/admin/tags/${tag.slug}`)}
              >
                {tag.slug}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};
