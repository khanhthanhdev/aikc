"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/web/ui/dropdown-menu";

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-32 animate-pulse rounded-lg bg-accent/50" />;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-accent p-1">
      <button
        aria-label="Light mode"
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-all ${
          theme === "light"
            ? "bg-background text-foreground shadow-sm"
            : "text-foreground/70 hover:text-foreground"
        }`}
        onClick={() => setTheme("light")}
        title="Light mode"
        type="button"
      >
        <svg
          aria-label="Light mode"
          fill="none"
          height="16"
          role="img"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
        <span>Light</span>
      </button>
      <button
        aria-label="Dark mode"
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-all ${
          theme === "dark"
            ? "bg-background text-foreground shadow-sm"
            : "text-foreground/70 hover:text-foreground"
        }`}
        onClick={() => setTheme("dark")}
        title="Dark mode"
        type="button"
      >
        <svg
          aria-label="Dark mode"
          fill="none"
          height="16"
          role="img"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <span>Dark</span>
      </button>
      <button
        aria-label="System theme"
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-all ${
          theme === "system"
            ? "bg-background text-foreground shadow-sm"
            : "text-foreground/70 hover:text-foreground"
        }`}
        onClick={() => setTheme("system")}
        title="Use system theme"
        type="button"
      >
        <svg
          aria-label="System theme"
          fill="none"
          height="16"
          role="img"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect height="14" rx="2" width="20" x="2" y="3" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>
        <span>Auto</span>
      </button>
    </div>
  );
}

/**
 * Compact theme switcher with dropdown menu
 */
export function ThemeSwitcherCompact() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9 animate-pulse rounded-md bg-accent/50" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Select theme"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
