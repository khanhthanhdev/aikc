import type NextLink from "next/link";
import { createNavigation } from "next-intl/navigation";
import { routing } from "~/i18n/routing";

const navigation = createNavigation(routing);

export const Link = navigation.Link as unknown as typeof NextLink;
export const usePathname = navigation.usePathname;
export const getPathname = navigation.getPathname as (
  ...args: unknown[]
) => string;
export const redirect = (href: string, options?: { locale?: string }) =>
  navigation.redirect(href as never, options as never);

export const useRouter = () => {
  const router = navigation.useRouter();

  return {
    ...router,
    push: (href: string, options?: { locale?: string; scroll?: boolean }) =>
      router.push(href as never, options as never),
    replace: (href: unknown, options?: { locale?: string; scroll?: boolean }) =>
      router.replace(href as never, options as never),
    prefetch: (href: string) => router.prefetch(href as never),
  };
};
