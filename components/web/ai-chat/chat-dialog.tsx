"use client";

import { useChat } from "@ai-sdk/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  BotIcon,
  LoaderIcon,
  MessageSquarePlusIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "~/utils/cva";
import { useChatContext } from "./chat-context";
import { ChatMarkdown } from "./chat-markdown";
import { SuggestedQuestions } from "./suggested-questions";
import {
  type YoutubeVideo,
  YoutubeVideos,
  YoutubeVideosLoading,
} from "./youtube-videos";

type ExtractedYoutubeVideo = YoutubeVideo;

/**
 * Extracts YouTube video info from markdown links in text
 */
function _extractYoutubeVideosFromText(text: string): ExtractedYoutubeVideo[] {
  const videos: ExtractedYoutubeVideo[] = [];
  const seen = new Set<string>();

  // Match markdown links: [Title](url) where url is a YouTube URL
  const markdownLinkRegex =
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)[^)]*)\)/g;

  let match: RegExpExecArray | null;
  match = markdownLinkRegex.exec(text);
  while (match !== null) {
    const [, title, url, videoId] = match;
    if (!seen.has(videoId)) {
      seen.add(videoId);
      videos.push({
        title,
        url,
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
    if (videos.length >= 3) {
      break; // Limit to 3 videos
    }
    match = markdownLinkRegex.exec(text);
  }

  return videos;
}

function parseFollowUpQuestions(text: string): {
  content: string;
  suggestions: string[];
} {
  const parts = text.split("---SUGGESTIONS---");
  if (parts.length < 2) {
    return { content: text, suggestions: [] };
  }

  const content = parts[0].trim();
  const suggestionsText = parts[1].trim();
  const suggestions = suggestionsText
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return { content, suggestions };
}

function getMessageText(message: UIMessage): string {
  const textParts: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      textParts.push(part.text);
    }
  }
  return textParts.join("\n");
}

export function ChatDialog() {
  const t = useTranslations("Chat");
  const locale = useLocale(); // Get current locale
  const { isOpen, setIsOpen, currentTool, suggestedQuestions } =
    useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [chatKey, setChatKey] = useState(0);

  // Use a ref to track the current tool slug to avoid stale closures in the useChat callback
  const toolSlugRef = useRef(currentTool?.slug);
  toolSlugRef.current = currentTool?.slug;

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `chat-${chatKey}`,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        toolSlug: toolSlugRef.current,
        locale, // Pass locale to API
      }),
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "assistant" && status === "ready") {
      const text = getMessageText(lastMessage);
      const { suggestions } = parseFollowUpQuestions(text);
      if (suggestions.length) {
        setFollowUpQuestions(suggestions);
      }
    }
  }, [messages, status]);

  const handleStartNewChat = useCallback(() => {
    setMessages([]);
    setFollowUpQuestions([]);
    setInput("");
    setChatKey((prev) => prev + 1);
  }, [setMessages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) {
        return;
      }

      sendMessage({ text: input.trim() });
      setInput("");
      setFollowUpQuestions([]);
    },
    [input, isLoading, sendMessage]
  );

  const handleQuestionSelect = useCallback(
    (question: string) => {
      if (isLoading) {
        return;
      }
      sendMessage({ text: question });
      setFollowUpQuestions([]);
    },
    [isLoading, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  const displayMessages = useMemo(() => {
    return messages.map((message) => {
      const text = getMessageText(message);
      if (message.role === "assistant") {
        const { content } = parseFollowUpQuestions(text);
        return { ...message, displayContent: content };
      }
      return { ...message, displayContent: text };
    });
  }, [messages]);

  const currentSuggestions = useMemo(() => {
    if (messages.length === 0) {
      return suggestedQuestions;
    }
    return followUpQuestions;
  }, [messages.length, suggestedQuestions, followUpQuestions]);

  const assistantContext = currentTool?.name ?? t("assistantName");

  return (
    <DialogPrimitive.Root modal={false} onOpenChange={setIsOpen} open={isOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cx(
            "fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]",
            "transition-opacity duration-200",
            "data-[state=closed]:animate-out data-[state=open]:animate-in",
            "data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
            "sm:hidden"
          )}
        />
        <DialogPrimitive.Content
          className={cx(
            "fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden bg-background shadow-2xl",
            "border-none sm:top-3 sm:right-3 sm:bottom-24 sm:left-auto sm:h-auto sm:w-[min(336px,calc(100vw-1.5rem))] sm:rounded-2xl sm:border sm:border-foreground/15",
            "data-[state=closed]:animate-out data-[state=open]:animate-in",
            "data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
            "transition-transform duration-300 ease-out data-[state=closed]:translate-x-full data-[state=open]:translate-x-0"
          )}
          data-allow-background-scroll="true"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            {t("srTitle")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("srDescription")}
          </DialogPrimitive.Description>
          <div className="flex items-center justify-between border-foreground/10 border-b px-3 py-3">
            <div className="inline-flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-200">
                <BotIcon className="size-4" />
              </span>
              <span className="rounded-full bg-sky-500/15 px-4 py-1.5 font-medium text-sky-700 text-sm dark:text-sky-200">
                {t("assistantBadge")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                aria-label={t("startNewChat")}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={handleStartNewChat}
                title={t("startNewChat")}
                type="button"
              >
                <MessageSquarePlusIcon className="size-4" />
              </button>
              <DialogPrimitive.Close className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground sm:hidden">
                <XIcon className="size-5" />
                <span className="sr-only">{t("close")}</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-5 pt-5 pb-4"
            data-lenis-prevent
          >
            {displayMessages.length === 0 ? (
              <div className="mx-auto flex w-full max-w-md flex-col gap-7 pb-6">
                <div className="space-y-3 text-left">
                  <p className="font-medium text-2xl leading-tight">
                    {t("greeting", { assistantName: t("assistantName") })}
                  </p>
                  <p className="text-foreground/75 text-sm leading-snug">
                    {t("welcomeDescription")}
                  </p>
                  <p className="text-foreground/75 text-sm leading-snug">
                    {t("askAnythingAbout")}{" "}
                    <span className="inline-block rounded-md bg-sky-400 px-2 py-1 font-semibold text-base text-sky-950">
                      {assistantContext}
                    </span>
                    .
                  </p>
                </div>

                <div>
                  <SuggestedQuestions
                    disabled={isLoading}
                    onSelect={handleQuestionSelect}
                    questions={currentSuggestions}
                  />
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-none flex-col gap-4 pb-4">
                {displayMessages.map((message) => (
                  <div
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    key={message.id}
                  >
                    <div
                      className={cx(
                        message.role === "user"
                          ? "max-w-[88%] rounded-2xl bg-foreground px-4 py-3 text-background"
                          : "w-full bg-transparent px-0 py-0 text-foreground"
                      )}
                    >
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap text-sm">
                          {message.displayContent}
                        </p>
                      ) : (
                        <>
                          {/* Render message parts following AI SDK 5.0 generative UI pattern */}
                          {message.parts.map((part, partIndex) => {
                            const partKey = `${message.id}-part-${partIndex}`;
                            // Handle text parts
                            if (part.type === "text") {
                              const { content } = parseFollowUpQuestions(
                                part.text
                              );
                              return (
                                <ChatMarkdown key={partKey}>
                                  {content}
                                </ChatMarkdown>
                              );
                            }

                            // Handle searchYoutubeVideos tool parts
                            if (part.type === "tool-searchYoutubeVideos") {
                              switch (part.state) {
                                case "input-available":
                                  return <YoutubeVideosLoading key={partKey} />;
                                case "output-available":
                                  return (
                                    <YoutubeVideos
                                      key={partKey}
                                      videos={
                                        part.output as ExtractedYoutubeVideo[]
                                      }
                                    />
                                  );
                                case "output-error":
                                  return (
                                    <div
                                      className="mt-2 text-red-500 text-xs"
                                      key={partKey}
                                    >
                                      {t("videoLoadFailed")}
                                    </div>
                                  );
                                default:
                                  return null;
                              }
                            }

                            return null;
                          })}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3">
                      <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground text-sm">
                        {t("thinking")}
                      </span>
                    </div>
                  </div>
                )}

                {!isLoading &&
                  currentSuggestions.length > 0 &&
                  messages.length > 0 && (
                    <div className="mt-4">
                      <SuggestedQuestions
                        disabled={isLoading}
                        onSelect={handleQuestionSelect}
                        questions={currentSuggestions}
                      />
                    </div>
                  )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form
            className="border-foreground/10 border-t bg-background px-4 py-4"
            onSubmit={handleSubmit}
          >
            <div className="relative mx-auto w-full max-w-md">
              <textarea
                className="w-full resize-none rounded-2xl border border-foreground/10 bg-foreground/5 px-5 py-4 pr-14 text-sm placeholder:text-foreground/45 focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                ref={inputRef}
                rows={1}
                value={input}
              />
              <button
                className="absolute top-1/2 right-5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/10 text-foreground/40 transition-colors enabled:bg-sky-500 enabled:text-sky-950 enabled:hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-80"
                disabled={!input.trim() || isLoading}
                type="submit"
              >
                <SendIcon className="size-4" />
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
