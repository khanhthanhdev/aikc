"use client";

import { type FormEvent, useState } from "react";
import { Button } from "~/components/web/ui/button";
import { Textarea } from "~/components/web/ui/textarea";

interface RagSandboxProps {
  answerLabel: string;
  errorLabel: string;
  questionLabel: string;
  questionPlaceholder: string;
  submitLabel: string;
}

export const RagSandbox = ({
  answerLabel,
  errorLabel,
  questionLabel,
  questionPlaceholder,
  submitLabel,
}: RagSandboxProps) => {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }

    setError(null);
    setIsPending(true);

    try {
      const apiResponse = await fetch("/api/rag", {
        body: JSON.stringify({ question: trimmedQuestion }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body: unknown = await apiResponse.json();

      if (!apiResponse.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : errorLabel;
        setError(message);
        return;
      }

      setResponse(body);
    } catch {
      setError(errorLabel);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={submitQuestion}>
      <label
        className="font-medium text-foreground text-sm"
        htmlFor="rag-question"
      >
        {questionLabel}
      </label>
      <Textarea
        id="rag-question"
        maxLength={500}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={questionPlaceholder}
        required
        rows={4}
        value={question}
      />
      <Button className="w-fit" isPending={isPending} type="submit">
        {submitLabel}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      {response ? (
        <div className="grid gap-2">
          <p className="font-medium text-foreground text-sm">{answerLabel}</p>
          <pre aria-live="polite">{JSON.stringify(response, null, 2)}</pre>
        </div>
      ) : null}
    </form>
  );
};
