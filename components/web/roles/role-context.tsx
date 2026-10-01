"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isUserRole,
  ROLE_COOKIE,
  ROLE_COOKIE_MAX_AGE,
  ROLE_SKIPPED,
  type UserRole,
} from "~/config/roles";
import { trackEvent } from "~/lib/analytics";

type RoleContextValue = {
  /** The visitor's role, or null when unknown or skipped. */
  role: UserRole | null;
  /** False until the cookie has been read, and while the visitor hasn't chosen. */
  hasChosen: boolean;
  isDialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  /** Remember a role, or null to skip. Either way the popup won't come back. */
  setRole: (role: UserRole | null) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const readRoleCookie = () => {
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${ROLE_COOKIE}=`))
    ?.slice(ROLE_COOKIE.length + 1);

  return value === undefined ? undefined : decodeURIComponent(value);
};

/**
 * Remembers the visitor's role in a cookie (not localStorage) so server
 * components can read it too: the home page renders its picks from it.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [hasChosen, setHasChosen] = useState(false);
  const [isDialogOpen, setDialogOpen] = useState(false);

  // The cookie is only readable after hydration
  useEffect(() => {
    const value = readRoleCookie();

    if (value === undefined) {
      setDialogOpen(true);
      return;
    }

    setRoleState(isUserRole(value) ? value : null);
    setHasChosen(true);
  }, []);

  const setRole = useCallback(
    (next: UserRole | null) => {
      const value = next ?? ROLE_SKIPPED;
      document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${ROLE_COOKIE_MAX_AGE}; samesite=lax`;

      setRoleState(next);
      setHasChosen(true);
      setDialogOpen(false);
      // Who the site serves, as visitors describe themselves
      trackEvent("pick_role", { role: value });

      // Re-render the server components that read the cookie
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({ role, hasChosen, isDialogOpen, setDialogOpen, setRole }),
    [role, hasChosen, isDialogOpen, setRole]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
