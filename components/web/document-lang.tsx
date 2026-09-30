"use client";

import { useEffect } from "react";

/**
 * The root layout renders `<html>` outside the locale segment, so it cannot
 * know the locale. Correct `lang` once the page runs, which is what screen
 * readers use to pick a voice.
 */
export const DocumentLang = ({ locale }: { locale: string }) => {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
};
