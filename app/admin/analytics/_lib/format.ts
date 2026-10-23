/** Number formatting shared by the analytics cards, matching GA4's style. */

export const formatNumber = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 0 });

export const formatDecimal = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatPercent = (value: number) =>
  `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

/** GA4 writes engagement time as "1m 05s". */
export const formatDuration = (seconds: number) => {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return minutes ? `${minutes}m ${rest}s` : `${total % 60}s`;
};

export type Change = { text: string; direction: "up" | "down" | "flat" };

/** Relative change from the previous period, or null when there is none. */
export const formatChange = (
  current: number,
  previous: number
): Change | null => {
  if (!previous) {
    return null;
  }

  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < 0.0005) {
    return { text: "0%", direction: "flat" };
  }

  return {
    text: `${Math.abs(ratio * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
    direction: ratio > 0 ? "up" : "down",
  };
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "🇻🇳 Vietnam" from "VN"; GA4's "(not set)" when unknown. */
export const formatCountry = (code: string | null) => {
  if (!code) {
    return "(not set)";
  }

  const flag = String.fromCodePoint(
    ...[...code].map((char) => 0x1_f1_e6 + char.charCodeAt(0) - 65)
  );

  try {
    return `${flag} ${regionNames.of(code) ?? code}`;
  } catch {
    return code;
  }
};

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

const DEVICE_NAMES: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};

export const formatLocale = (value: string | null) =>
  (value && LOCALE_NAMES[value]) ?? "(not set)";

export const formatDevice = (value: string | null) =>
  (value && DEVICE_NAMES[value]) ?? "(not set)";

/** Chart axis label for a bucket key: "Oct 23" for days, "14:00" for hours. */
export const formatBucket = (bucket: string) => {
  const [day, hour] = bucket.split("T");
  if (hour) {
    return `${hour}:00`;
  }

  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};
