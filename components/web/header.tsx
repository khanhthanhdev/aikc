"use client";

import {
  CalendarIcon,
  ClockIcon,
  ScaleIcon,
  SparkleIcon,
  TagIcon,
  TicketIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type HTMLAttributes, Suspense, useEffect, useState } from "react";
import { Logo } from "~/components/common/logo";
import { Stack } from "~/components/common/stack";
import { ThemeSwitcherCompact } from "~/components/common/theme-switcher";
import { SearchForm } from "~/components/web/search-form";
import { Button } from "~/components/web/ui/button";
import { Container } from "~/components/web/ui/container";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/web/ui/dropdown-menu";
import {
  NavigationLink,
  navigationLinkVariants,
} from "~/components/web/ui/navigation-link";
import { Link, usePathname } from "~/i18n/navigation";
import { cx } from "~/utils/cva";
import { LocaleSwitcher } from "./locale-switcher";
export const Header = ({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) => {
  const t = useTranslations("Navigation");
  const [isNavOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close the mobile navigation on route change
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }

  // Close the mobile navigation when the user presses the "Escape" key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Container
      className={cx(
        "group/menu sticky inset-x-0 top-[var(--header-top)] z-[49] duration-300",
        "max-lg:data-[state=open]:bg-background/90",
        className
      )}
      data-state={isNavOpen ? "open" : "close"}
      id="header"
      role="banner"
      {...props}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[calc(var(--header-top)+var(--header-height)+2rem)] bg-gradient-to-b from-background via-background to-transparent lg:h-[calc(var(--header-top)+var(--header-height)+3rem)]" />

      <div className="relative isolate flex h-[var(--header-height)] items-center gap-x-3 py-3.5 text-md duration-300 lg:gap-4">
        <Stack className="mr-auto flex-nowrap" size="sm">
          <button
            aria-label={t("toggleNavigation")}
            className="-m-1 -ml-1.5 block lg:hidden"
            onClick={() => setNavOpen(!isNavOpen)}
            type="button"
          >
            <svg
              aria-label={t("toggleNavigation")}
              className="size-7 select-none duration-300 will-change-transform group-data-[state=open]/menu:rotate-45"
              role="img"
              viewBox="0 0 100 100"
            >
              <path
                className="fill-none stroke-[5] stroke-current duration-300 [stroke-dasharray:40_121] [stroke-linecap:round] group-data-[state=open]/menu:[stroke-dashoffset:-68px]"
                d="m 70,33 h -40 c 0,0 -8.5,-0.149796 -8.5,8.5 0,8.649796 8.5,8.5 8.5,8.5 h 20 v -20"
              />
              <path
                className="fill-none stroke-[5] stroke-current duration-300 [stroke-linecap:round]"
                d="m 55,50 h -25"
              />
              <path
                className="fill-none stroke-[5] stroke-current duration-300 [stroke-dasharray:40_121] [stroke-linecap:round] group-data-[state=open]/menu:[stroke-dashoffset:-68px]"
                d="m 30,67 h 40 c 0,0 8.5,0.149796 8.5,-8.5 0,-8.649796 -8.5,-8.5 -8.5,-8.5 h -20 v 20"
              />
            </svg>
          </button>

          <Logo />
        </Stack>

        <Stack className="ml-auto lg:hidden" size="sm">
          <ThemeSwitcherCompact />
          <LocaleSwitcher />
          <Suspense fallback={<div className="size-4" />}>
            <SearchForm />
          </Suspense>
        </Stack>

        <nav className="contents max-lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cx(navigationLinkVariants(), "gap-1")}
            >
              {t("browse")}{" "}
              <svg
                aria-hidden="true"
                className="size-4 opacity-50 duration-200 group-data-[state=open]:rotate-180"
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="min-w-[220px]">
              <DropdownMenuItem asChild>
                <NavigationLink href="/?sort=publishedAt.desc">
                  <CalendarIcon className="mr-2 size-4 text-muted-foreground" />{" "}
                  {t("latest")}
                </NavigationLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavigationLink href="/categories">
                  <TagIcon className="mr-2 size-4 text-muted-foreground" />{" "}
                  {t("categories")}
                </NavigationLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavigationLink href="/tags">
                  <TagIcon className="mr-2 size-4 text-muted-foreground" />{" "}
                  {t("tags")}
                </NavigationLink>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <NavigationLink href="/?pricing=free">
                  <TicketIcon className="mr-2 size-4 text-muted-foreground" />{" "}
                  {t("freeTools")}
                </NavigationLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavigationLink href="/?pricing=freemium">
                  <ScaleIcon className="mr-2 size-4 text-muted-foreground" />{" "}
                  {t("freemiumTools")}
                </NavigationLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavigationLink href="/?pricing=paid">
                  <ClockIcon className="mr-2 size-4 text-muted-foreground" />{" "}
                  {t("paidTools")}
                </NavigationLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <NavigationLink href="/categories">{t("categories")}</NavigationLink>
          <NavigationLink href="/collections">
            {t("collections")}
          </NavigationLink>
          <NavigationLink href="/about">{t("aboutUs")}</NavigationLink>
        </nav>

        <Stack className="max-lg:hidden" size="sm">
          <ThemeSwitcherCompact />

          <LocaleSwitcher />

          <Suspense fallback={<div className="size-4" />}>
            <SearchForm />
          </Suspense>

          <Button asChild prefix={<SparkleIcon />} size="lg" variant="primary">
            <Link href="/submit">{t("submit")}</Link>
          </Button>
        </Stack>
      </div>

      <nav
        className={cx(
          "absolute inset-x-0 top-full -mt-px grid h-[calc(100dvh-var(--header-top)-var(--header-height))] grid-cols-2 place-content-start place-items-start gap-x-4 gap-y-6 bg-background/90 px-6 py-4 backdrop-blur-lg transition-opacity lg:hidden",
          isNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <NavigationLink className="text-base" href="/?sort=publishedAt.desc">
          {t("latest")}
        </NavigationLink>
        <NavigationLink className="text-base" href="/collections">
          {t("collections")}
        </NavigationLink>
        <NavigationLink className="text-base" href="/submit">
          {t("submit")}
        </NavigationLink>
        <NavigationLink className="text-base" href="/about">
          {t("aboutUs")}
        </NavigationLink>
      </nav>

      {props.children}
    </Container>
  );
};
