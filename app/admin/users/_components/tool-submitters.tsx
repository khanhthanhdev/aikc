import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import type { getToolSubmitters } from "~/app/admin/users/_lib/queries";
import { H4 } from "~/components/common/heading";
import { badgeVariants } from "~/components/admin/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/admin/ui/table";
import { isToolPublished } from "~/lib/tools";
import { cx } from "~/utils/cva";

type ToolSubmittersProps = {
  submittersPromise: ReturnType<typeof getToolSubmitters>;
};

export async function ToolSubmitters({
  submittersPromise,
}: ToolSubmittersProps) {
  const submitters = await submittersPromise;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <H4 as="h2">
          Tool submitters
          <span className="ml-1.5 opacity-40">({submitters.length})</span>
        </H4>
        <p className="text-muted-foreground text-sm">
          People who suggested tools through the submit form. Contact only: they
          have no admin access.
        </p>
      </div>

      {submitters.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitter</TableHead>
                <TableHead>Tools</TableHead>
                <TableHead className="whitespace-nowrap">
                  Last Submission
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {submitters.map(({ email, name, tools, lastSubmittedAt }) => (
                <TableRow key={email}>
                  <TableCell className="align-top">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {name || email}
                      </span>
                      <a
                        className="truncate text-muted-foreground text-xs hover:underline"
                        href={`mailto:${email}`}
                      >
                        {email}
                      </a>
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map((tool) => (
                        <Link
                          className={badgeVariants({ variant: "outline" })}
                          href={`/admin/tools/${tool.slug}`}
                          key={tool.slug}
                          title={getToolStatus(tool)}
                        >
                          <span
                            className={cx(
                              "mr-1.5 size-1.5 rounded-full",
                              STATUS_COLORS[getToolStatus(tool)]
                            )}
                          />
                          {tool.name}
                        </Link>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell
                    className="whitespace-nowrap align-top text-muted-foreground"
                    title={lastSubmittedAt.toLocaleString()}
                  >
                    {formatDistanceToNowStrict(lastSubmittedAt, {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="rounded-md border p-4 text-muted-foreground text-sm">
          No tools have been submitted through the form yet.
        </p>
      )}
    </section>
  );
}

const getToolStatus = (tool: { publishedAt: Date | null }) => {
  if (isToolPublished(tool)) {
    return "Published";
  }
  return tool.publishedAt ? "Scheduled" : "Pending review";
};

const STATUS_COLORS = {
  Published: "bg-green-500",
  Scheduled: "bg-blue-500",
  "Pending review": "bg-yellow-500",
} as const;
