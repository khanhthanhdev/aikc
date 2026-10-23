"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TRACK_URL = "/api/track";

type CurrentView = {
  id: string;
  /** Visible time banked so far, excluding the running stretch. */
  engagedMs: number;
  /** When the current visible stretch began, or null while hidden. */
  visibleSince: number | null;
  /** Read a moment after the page shows, once its metadata has streamed in. */
  title?: string;
};

/** Long enough for streamed metadata, short enough to beat most clicks. */
const TITLE_DELAY_MS = 1000;

const send = (payload: Record<string, unknown>) => {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon?.(TRACK_URL, body)) {
    return;
  }

  fetch(TRACK_URL, { method: "POST", body, keepalive: true }).catch(() => {
    // A missed page view is not worth bothering the visitor about
  });
};

const engagedSoFar = (view: CurrentView) =>
  view.engagedMs +
  (view.visibleSince === null ? 0 : performance.now() - view.visibleSince);

/**
 * Reports each public page to /api/track the way GA4 measures it: a "start"
 * when the page is shown, and an "end" with the time it was visible (GA4's
 * engagement time) when the visitor moves on, hides the tab or leaves.
 * Client-side navigation counts as a new page; prefetches never do.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const view = useRef<CurrentView | null>(null);

  // Close the open view with its engagement time. An "end" can be sent more
  // than once (tab hidden, shown, hidden again); the server keeps the latest.
  const sendEnd = useRef(() => {
    const { current } = view;
    if (!current) {
      return;
    }

    send({
      type: "end",
      id: current.id,
      engagedMs: Math.round(engagedSoFar(current)),
      title: current.title,
    });
  });

  useEffect(() => {
    // Keep local browsing out of the numbers
    if (process.env.NODE_ENV !== "production" || !pathname) {
      return;
    }

    sendEnd.current();

    const id = crypto.randomUUID();
    const visible = document.visibilityState === "visible";
    view.current = {
      id,
      engagedMs: 0,
      visibleSince: visible ? performance.now() : null,
    };

    send({ type: "start", id, path: pathname });

    // By the time this effect runs after a client navigation, the title may
    // still be the previous page's, so read it later. A view left sooner
    // sends no title and the report uses the one other visits sent.
    const { current } = view;
    const timer = setTimeout(() => {
      current.title = document.title || undefined;
    }, TITLE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const onVisibilityChange = () => {
      const { current } = view;
      if (!current) {
        return;
      }

      if (document.visibilityState === "hidden") {
        current.engagedMs = engagedSoFar(current);
        current.visibleSince = null;
        // Hiding is the last reliable moment on mobile, so report now
        sendEnd.current();
      } else if (current.visibleSince === null) {
        current.visibleSince = performance.now();
      }
    };

    const onPageHide = () => sendEnd.current();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
