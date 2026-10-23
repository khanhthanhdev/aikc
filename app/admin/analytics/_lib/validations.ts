import * as z from "zod";

/**
 * Date presets, as GA4's date menu offers them. "Last N days" include today,
 * so a fresh deploy shows numbers without waiting a day. Any `from`/`to` in
 * the URL (from the date range picker) wins over the preset.
 */
export const analyticsPresets = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "28d": "Last 28 days",
  "90d": "Last 90 days",
  custom: "Custom",
} as const;

export type AnalyticsPreset = keyof typeof analyticsPresets;

export const DEFAULT_ANALYTICS_PRESET: AnalyticsPreset = "28d";

const presetKeys = Object.keys(analyticsPresets) as [
  AnalyticsPreset,
  ...AnalyticsPreset[],
];

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const searchParamsSchema = z.object({
  range: z.enum(presetKeys).catch(DEFAULT_ANALYTICS_PRESET),
  from: day,
  to: day,
  compare: z
    .enum(["true", "false"])
    .catch("true")
    .transform((value) => value === "true"),
});

export type AnalyticsSearchParams = z.infer<typeof searchParamsSchema>;
