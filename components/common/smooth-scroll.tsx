"use client";

import Lenis from "lenis";
import { useEffect } from "react";

export function SmoothScroll() {
  useEffect(() => {
    let rafId: number | null = null;
    let isDestroyed = false;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      // Prevent Lenis from hijacking scroll on elements with data-lenis-prevent
      prevent: (node) => {
        // Check if the node or any ancestor has data-lenis-prevent attribute
        let current: HTMLElement | null = node as HTMLElement;
        while (current) {
          if (current.hasAttribute?.("data-lenis-prevent")) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      },
    });

    function raf(time: number) {
      if (isDestroyed) {
        return;
      }
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    // Monitor for modal/dialog open state using MutationObserver.
    // Dialogs can opt out of page scroll locking with data-allow-background-scroll="true".
    const checkForOpenModals = () => {
      const hasOpenModal = document.querySelector(
        '[data-state="open"][data-radix-dialog-overlay], [data-state="open"][role="dialog"]:not([data-allow-background-scroll="true"])'
      );
      if (hasOpenModal) {
        lenis.stop();
      } else {
        lenis.start();
      }
    };

    const observer = new MutationObserver(() => {
      checkForOpenModals();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    // Initial check
    checkForOpenModals();

    return () => {
      isDestroyed = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      lenis.destroy();
    };
  }, []);

  return null;
}
