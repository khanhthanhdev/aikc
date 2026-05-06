"use client";

import { useTranslations } from "next-intl";

interface SuggestedQuestionsProps {
  disabled?: boolean;
  onSelect: (question: string) => void;
  questions: string[];
}

export function SuggestedQuestions({
  questions,
  onSelect,
  disabled,
}: SuggestedQuestionsProps) {
  const t = useTranslations("Chat");

  if (!questions.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-[0.68rem] text-foreground/50 uppercase tracking-[0.16em]">
        {t("exampleQuestions")}
      </p>
      <div className="flex flex-col gap-1">
        {questions.map((question) => (
          <button
            className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-2 text-center text-foreground/80 text-xs transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            key={question}
            onClick={() => onSelect(question)}
            type="button"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
