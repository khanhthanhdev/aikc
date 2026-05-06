"use client";

import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export function useDebouncedState<T = unknown>(
  defaultValue: T,
  wait: number,
  options = { leading: false }
) {
  const [value, setValue] = useState(defaultValue);
  const timeoutRef = useRef<number | null>(null);
  const leadingRef = useRef(true);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearTimeoutRef, [clearTimeoutRef]);

  const debouncedSetValue = useCallback(
    (newValue: SetStateAction<T>) => {
      clearTimeoutRef();
      if (leadingRef.current && options.leading) {
        setValue(newValue);
      } else {
        timeoutRef.current = window.setTimeout(() => {
          leadingRef.current = true;
          setValue(newValue);
        }, wait);
      }
      leadingRef.current = false;
    },
    [options.leading, clearTimeoutRef, wait]
  );

  return [value, debouncedSetValue] as const;
}
