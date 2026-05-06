"use client";

import { MessageCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatContext } from "./chat-context";

export function ChatButton() {
  const t = useTranslations("Chat");
  const { isOpen, toggleChat } = useChatContext();

  if (isOpen) {
    return (
      <button
        aria-label={t("close")}
        className="fixed right-6 bottom-6 z-[60] hidden items-center gap-2 rounded-full bg-foreground px-5 py-3 text-background text-base shadow-lg transition-all hover:scale-105 hover:bg-foreground/85 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 sm:inline-flex"
        onClick={toggleChat}
        type="button"
      >
        <XIcon className="size-5" />
        <span>{t("close")}</span>
      </button>
    );
  }

  return (
    <button
      aria-label={t("openChat")}
      className="fixed right-6 bottom-6 z-[60] flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-all hover:scale-105 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
      onClick={toggleChat}
      type="button"
    >
      <MessageCircleIcon className="size-6" />
    </button>
  );
}
