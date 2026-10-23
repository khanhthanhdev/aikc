import {
  endOfAdminDay,
  startOfAdminDay,
  toAdminDay,
} from "~/utils/admin-dates";
import type { AnalyticsSearchParams } from "./validations";

const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_DAYS = 366;

export type Period = {
  from: Date;
  to: Date;
  /** Chart buckets: hours for a single day, as GA4 does, days otherwise. */
  buckets: string[];
  granularity: "hour" | "day";
};

export type AnalyticsRange = {
  current: Period;
  /** The same length of time right before `current`. */
  previous: Period;
};

const shiftDays = (day: string, days: number) =>
  // Midday, so the step never lands on the wrong side of a day boundary
  toAdminDay(
    new Date(startOfAdminDay(day).getTime() + days * DAY_MS + DAY_MS / 2)
  );

const daysBetween = (first: string, last: string) => {
  const days: string[] = [];
  for (let day = first; day <= last; day = shiftDays(day, 1)) {
    days.push(day);
  }
  return days;
};

const periodOf = (first: string, last: string): Period => {
  const days = daysBetween(first, last);

  if (days.length === 1) {
    return {
      from: startOfAdminDay(first),
      to: endOfAdminDay(first),
      buckets: Array.from(
        { length: 24 },
        (_, hour) => `${first}T${String(hour).padStart(2, "0")}`
      ),
      granularity: "hour",
    };
  }

  return {
    from: startOfAdminDay(first),
    to: endOfAdminDay(last),
    buckets: days,
    granularity: "day",
  };
};

/** First and last admin day the search params ask for. */
const selectedDays = ({ range, from, to }: AnalyticsSearchParams) => {
  const today = toAdminDay(new Date());

  if (from) {
    const last = to && to >= from ? to : from;
    // A year is plenty, and keeps a typo like 2002 from building 9000 buckets
    const earliest = shiftDays(last, -(MAX_DAYS - 1));
    return [from < earliest ? earliest : from, last] as const;
  }

  switch (range) {
    case "today":
      return [today, today] as const;
    case "yesterday":
      return [shiftDays(today, -1), shiftDays(today, -1)] as const;
    case "7d":
      return [shiftDays(today, -6), today] as const;
    case "90d":
      return [shiftDays(today, -89), today] as const;
    default:
      return [shiftDays(today, -27), today] as const;
  }
};

export const resolveRange = (search: AnalyticsSearchParams): AnalyticsRange => {
  const [first, last] = selectedDays(search);
  const { length } = daysBetween(first, last);

  return {
    current: periodOf(first, last),
    previous: periodOf(shiftDays(first, -length), shiftDays(first, -1)),
  };
};
