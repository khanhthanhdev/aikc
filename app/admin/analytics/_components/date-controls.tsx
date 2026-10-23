"use client";

import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useTransition } from "react";
import { DateRangePicker } from "~/components/admin/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/admin/ui/select";
import { Switch } from "~/components/admin/ui/switch";
import {
  type AnalyticsPreset,
  analyticsPresets,
  DEFAULT_ANALYTICS_PRESET,
} from "../_lib/validations";

type DateControlsProps = {
  /** The resolved first and last day, `yyyy-MM-dd`, for the picker label. */
  firstDay: string;
  lastDay: string;
};

/** A `yyyy-MM-dd` day as local midnight, which is what the calendar shows. */
const toLocalDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
};

const presetKeys = Object.keys(analyticsPresets) as AnalyticsPreset[];

/** GA4's date menu: quick presets, a custom range and period comparison. */
export const DateControls = ({ firstDay, lastDay }: DateControlsProps) => {
  const [isPending, startTransition] = useTransition();
  const [{ range, from, compare }, setParams] = useQueryStates(
    {
      range: parseAsStringLiteral(presetKeys).withDefault(
        DEFAULT_ANALYTICS_PRESET
      ),
      from: parseAsString,
      to: parseAsString,
      compare: parseAsBoolean.withDefault(true),
    },
    // The numbers are rendered on the server, so refetch on change
    { shallow: false, startTransition }
  );

  const preset: AnalyticsPreset = from ? "custom" : range;

  const onPresetChange = (value: string) => {
    // "custom" keeps the current days and opens them up for the picker
    if (value === "custom") {
      setParams({ range: "custom", from: firstDay, to: lastDay });
      return;
    }
    setParams({ range: value as AnalyticsPreset, from: null, to: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        disabled={isPending}
        onValueChange={onPresetChange}
        value={preset}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {presetKeys.map((key) => (
            <SelectItem key={key} value={key}>
              {analyticsPresets[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <DateRangePicker
          align="end"
          // Read once on mount; after that the picker owns the selection,
          // so picking the first day does not reset it mid-range
          dateRange={{ from: toLocalDate(firstDay), to: toLocalDate(lastDay) }}
          triggerSize="md"
        />
      )}

      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Switch
          checked={compare}
          disabled={isPending}
          id="analytics-compare"
          onCheckedChange={(checked) => setParams({ compare: checked })}
        />
        <label htmlFor="analytics-compare">Compare to previous period</label>
      </div>
    </div>
  );
};
