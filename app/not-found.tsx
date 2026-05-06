import Link from "next/link";
import { Button } from "~/components/web/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="font-bold text-6xl">404</h1>
      <h2 className="mt-4 font-semibold text-2xl">Page Not Found</h2>
      <p className="mt-2 text-foreground/70">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Button asChild className="mt-6" variant="primary">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}
