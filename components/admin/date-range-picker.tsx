"use client";

import { addDays, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Button, type ButtonProps } from "~/components/admin/ui/button";
import { Calendar } from "~/components/admin/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/admin/ui/popover";
import { cx } from "~/utils/cva";

interface DateRangePickerProps
  extends React.ComponentPropsWithoutRef<typeof PopoverContent> {
  /**
   * The selected date range.
   * @default undefined
   * @type DateRange
   * @example { from: new Date(), to: new Date() }
   */
  dateRange?: DateRange;

  /**
   * The number of days to display in the date range picker.
   * @default undefined
   * @type number
   * @example 7
   */
  dayCount?: number;

  /**
   * The placeholder text of the calendar trigger button.
   * @default "Pick a date"
   * @type string | undefined
   */
  placeholder?: string;

  /**
   * The class name of the calendar trigger button.
   * @default undefined
   * @type string
   */
  triggerClassName?: string;

  /**
   * The size of the calendar trigger button.
   * @default "default"
   * @type "default" | "sm" | "lg"
   */
  triggerSize?: ButtonProps["size"];

  /**
   * The variant of the calendar trigger button.
   * @default "outline"
   * @type "default" | "outline" | "secondary" | "ghost"
   */
  triggerVariant?: Exclude<ButtonProps["variant"], "destructive" | "link">;
}

export const DateRangePicker = ({
  dateRange,
  dayCount,
  placeholder = "Pick a date",
  triggerVariant = "outline",
  triggerSize = "md",
  triggerClassName,
  className,
  ...props
}: DateRangePickerProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    let fromDay: Date | undefined;
    let toDay: Date | undefined;

    if (dateRange) {
      fromDay = dateRange.from;
      toDay = dateRange.to;
    } else if (dayCount) {
      toDay = new Date();
      fromDay = addDays(toDay, -dayCount);
    }

    return {
      from: fromParam ? new Date(fromParam) : fromDay,
      to: toParam ? new Date(toParam) : toDay,
    };
  });

  // Track whether this is the initial mount
  const isInitialMount = React.useRef(true);

  // Update query string only when user changes the date
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);
    if (date?.from) {
      newSearchParams.set("from", format(date.from, "yyyy-MM-dd"));
    } else {
      newSearchParams.delete("from");
    }

    if (date?.to) {
      newSearchParams.set("to", format(date.to, "yyyy-MM-dd"));
    } else {
      newSearchParams.delete("to");
    }

    const newUrl = `${pathname}?${newSearchParams.toString()}`;
    const currentUrl = `${pathname}?${searchParams.toString()}`;

    // Only navigate if the URL actually changed
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [date?.from, date?.to, pathname, router, searchParams]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className={cx(
            "shrink-0 justify-start truncate text-left",
            !date && "text-muted-foreground",
            triggerClassName
          )}
          prefix={<CalendarIcon />}
          size={triggerSize}
          variant={triggerVariant}
        >
          {date?.from ? (
            date.to ? (
              `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
            ) : (
              `${format(date.from, "LLL dd, y")}`
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className={cx("w-auto p-0", className)} {...props}>
        <Calendar
          defaultMonth={date?.from}
          initialFocus
          mode="range"
          numberOfMonths={2}
          onSelect={setDate}
          selected={date}
        />
      </PopoverContent>
    </Popover>
  );
};
