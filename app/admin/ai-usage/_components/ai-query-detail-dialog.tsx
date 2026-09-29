"use client";

import type { AiQueryStatus } from "@prisma/client";
import { format } from "date-fns";
import { type ReactNode, useState } from "react";
import { useServerAction } from "zsa-react";
import { Badge } from "~/components/admin/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/admin/ui/dialog";
import { getAiQueryAnswer } from "../_lib/actions";
import type { AiQueryRow } from "../_lib/queries";

const SUGGESTIONS_MARKER = "---SUGGESTIONS---";

export const statusStyles: Record<AiQueryStatus, string> = {
  ABORTED: "bg-amber-100 text-amber-700",
  ERROR: "bg-red-100 text-red-700",
  OK: "bg-green-100 text-green-700",
};

type AiQueryDetailDialogProps = {
  query: AiQueryRow;
};

export const AiQueryDetailDialog = ({ query }: AiQueryDetailDialogProps) => {
  // undefined = not fetched yet, null = the row has no answer
  const [answer, setAnswer] = useState<string | null>();
  const { execute, isPending, error } = useServerAction(getAiQueryAnswer);

  const onOpenChange = async (open: boolean) => {
    if (open && answer === undefined) {
      const [data] = await execute({ id: query.id });

      if (data !== undefined) {
        setAnswer(data);
      }
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          className="line-clamp-2 max-w-xl cursor-pointer text-left hover:underline"
          title="Show question and answer"
          type="button"
        >
          {query.question}
        </button>
      </DialogTrigger>

      <DialogContent className="top-[5%] max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{query.question}</DialogTitle>
          <DialogDescription>
            {format(query.createdAt, "yyyy-MM-dd HH:mm:ss")}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Meta label="Status">
            <Badge className={statusStyles[query.status]} variant="outline">
              {query.status.toLowerCase()}
            </Badge>
          </Meta>
          <Meta label="Endpoint">{query.endpoint}</Meta>
          <Meta label="Tool">{query.toolSlug ?? "—"}</Meta>
          <Meta label="Locale">{query.locale?.toUpperCase() ?? "—"}</Meta>
          <Meta label="Cache">{query.cacheHit ? "hit" : "miss"}</Meta>
          <Meta label="Model">{query.model ?? "—"}</Meta>
          <Meta label="Tokens (in / out)">{formatTokens(query)}</Meta>
          <Meta label="Latency">
            {query.latencyMs === null ? "—" : `${query.latencyMs} ms`}
          </Meta>
          <Meta label="Visitor">
            <span className="font-mono text-xs">
              {query.visitorId?.slice(0, 8) ?? "—"}
            </span>
          </Meta>
        </dl>

        {query.error && (
          <pre className="whitespace-pre-wrap break-words rounded-md bg-red-50 p-3 text-red-800 text-xs">
            {query.error}
          </pre>
        )}

        <AnswerBody answer={answer} error={error?.message} isPending={isPending} />
      </DialogContent>
    </Dialog>
  );
};

const Meta = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="break-words">{children}</dd>
  </div>
);

const AnswerBody = ({
  answer,
  error,
  isPending,
}: {
  answer: string | null | undefined;
  error?: string;
  isPending: boolean;
}) => {
  if (isPending || (answer === undefined && !error)) {
    return <p className="text-muted-foreground text-sm">Loading answer…</p>;
  }

  if (error) {
    return <p className="text-red-700 text-sm">{error}</p>;
  }

  if (!answer) {
    return (
      <p className="text-muted-foreground text-sm">
        No answer stored for this question.
      </p>
    );
  }

  const [body = "", suggestionBlock] = answer.split(SUGGESTIONS_MARKER);
  const suggestions = (suggestionBlock ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <div className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">
        {body.trim()}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            Suggested follow-ups
          </span>
          <ul className="list-disc pl-5 text-sm">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const formatTokens = ({
  inputTokens,
  outputTokens,
}: Pick<AiQueryRow, "inputTokens" | "outputTokens">) =>
  inputTokens === null && outputTokens === null
    ? "—"
    : `${inputTokens?.toLocaleString() ?? "?"} / ${outputTokens?.toLocaleString() ?? "?"}`;
