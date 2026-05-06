"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "~/components/admin/ui/button";
import { H3 } from "~/components/common/heading";

export default function NotFound() {
  const pathname = usePathname();

  return (
    <div className="flex max-w-lg flex-col items-start gap-2">
      <H3 as="h1">404 Not Found</H3>

      <p className="text-muted-foreground">
        We're sorry, but the page {pathname} could not be found. You may have
        mistyped the address or the page may have moved.
      </p>

      <Button asChild className="mt-4">
        <Link href="/admin">Go back home</Link>
      </Button>
    </div>
  );
}
