"use client";

import { useEffect } from "react";
import { Button } from "~/components/admin/ui/button";
import { H3 } from "~/components/common/heading";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex max-w-lg flex-col items-start gap-2">
      <H3 as="h1">Something went wrong!</H3>

      <p className="text-muted-foreground text-sm">
        Please try again. If the problem persists, contact support.
      </p>

      <Button className="mt-4" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
