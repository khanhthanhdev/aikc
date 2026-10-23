"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the page's server components every `seconds`, while visible. */
export const AutoRefresh = ({ seconds }: { seconds: number }) => {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, seconds * 1000);

    return () => clearInterval(timer);
  }, [router, seconds]);

  return null;
};
