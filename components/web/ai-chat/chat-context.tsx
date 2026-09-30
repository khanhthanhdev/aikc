"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRole } from "~/components/web/roles/role-context";
import type { RoleQuestions } from "~/config/roles";
import { pickQuestions } from "~/lib/role-questions";

interface ToolInfo {
  name: string;
  /** Sample questions written for this tool, per audience role. */
  roleQuestions?: RoleQuestions;
  slug: string;
}

interface ChatContextValue {
  /** Open the chat and send this question, as if the visitor typed it. */
  askQuestion: (question: string) => void;
  /** Taken by the chat dialog once it can send; see `askQuestion`. */
  clearPendingQuestion: () => void;
  currentTool: ToolInfo | null;
  isOpen: boolean;
  locale: string;
  pendingQuestion: string | null;
  setCurrentTool: (tool: ToolInfo | null) => void;
  setIsOpen: (open: boolean) => void;
  startNewChat: () => void;
  suggestedQuestions: string[];
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// Default questions by locale
const DEFAULT_QUESTIONS = {
  en: [
    "What Work & Study tools do you recommend?",
    "Help me find a tool for API testing",
    "What are the best free Work & Study tools?",
  ],
  vi: [
    "Bạn gợi ý công cụ Học tập & Làm việc nào?",
    "Giúp tôi tìm công cụ kiểm thử API",
    "Công cụ Học tập & Làm việc miễn phí nào tốt nhất?",
  ],
};

// Tool questions template by locale
const TOOL_QUESTIONS_TEMPLATES = {
  en: {
    howToUse: (name: string) => `How do I use ${name}?`,
    alternatives: (name: string) => `What are alternatives to ${name}?`,
    keyFeatures: (name: string) => `What are the key features of ${name}?`,
  },
  vi: {
    howToUse: (name: string) => `Cách sử dụng ${name} như thế nào?`,
    alternatives: (name: string) =>
      `Có những lựa chọn thay thế nào cho ${name}?`,
    keyFeatures: (name: string) => `Những tính năng chính của ${name} là gì?`,
  },
};

function getQuestionsForLocale(locale: string): string[] {
  const normalizedLocale = locale.split("-")[0]; // Handle locale variants like 'en-US' -> 'en'
  return (
    DEFAULT_QUESTIONS[normalizedLocale as keyof typeof DEFAULT_QUESTIONS] ||
    DEFAULT_QUESTIONS.en
  );
}

function getToolQuestionsForLocale(tool: ToolInfo, locale: string): string[] {
  const normalizedLocale = locale.split("-")[0]; // Handle locale variants like 'en-US' -> 'en'
  const templates =
    TOOL_QUESTIONS_TEMPLATES[
      normalizedLocale as keyof typeof TOOL_QUESTIONS_TEMPLATES
    ] || TOOL_QUESTIONS_TEMPLATES.en;

  return [
    templates.howToUse(tool.name),
    templates.alternatives(tool.name),
    templates.keyFeatures(tool.name),
  ];
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const locale = useLocale(); // Get current locale from next-intl
  const [isOpen, setIsOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolInfo | null>(null);
  const [, forceUpdate] = useState({});
  // Picks which sample questions show; 0 until the chat is first opened, so
  // the server and client render the same ones
  const [questionSeed, setQuestionSeed] = useState(0);

  const reshuffleQuestions = useCallback(() => {
    setQuestionSeed(Math.floor(Math.random() * 2 ** 32) || 1);
  }, []);

  const openChange = useCallback(
    (open: boolean) => {
      if (open) {
        reshuffleQuestions();
      }
      setIsOpen(open);
    },
    [reshuffleQuestions]
  );

  const toggleChat = useCallback(() => {
    openChange(!isOpen);
  }, [isOpen, openChange]);

  // The dialog is loaded lazily, so the question waits here until it sends it
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const askQuestion = useCallback(
    (question: string) => {
      setPendingQuestion(question);
      openChange(true);
    },
    [openChange]
  );

  const clearPendingQuestion = useCallback(() => {
    setPendingQuestion(null);
  }, []);

  const startNewChat = useCallback(() => {
    reshuffleQuestions();
    // Force re-render to reset chat messages
    forceUpdate({});
  }, [reshuffleQuestions]);

  const { role } = useRole();
  const tRoles = useTranslations("Roles");

  // Questions for the visitor's role when we have them, generic ones otherwise.
  // Role questions come from a larger pool, so each opening shows a new mix.
  const suggestedQuestions = useMemo(() => {
    const language = locale.split("-")[0] === "vi" ? "vi" : "en";

    if (!role) {
      return currentTool
        ? getToolQuestionsForLocale(currentTool, locale)
        : getQuestionsForLocale(locale);
    }

    if (!currentTool) {
      return pickQuestions(
        tRoles.raw(`${role}.questions`) as string[],
        questionSeed
      );
    }

    const written = currentTool.roleQuestions?.[role]?.[language];
    if (written?.length) {
      return pickQuestions(written, questionSeed);
    }

    const [, ...generic] = getToolQuestionsForLocale(currentTool, locale);
    return [
      tRoles("toolQuestion", {
        name: currentTool.name,
        persona: tRoles(`${role}.persona`),
      }),
      ...generic,
    ];
  }, [currentTool, locale, questionSeed, role, tRoles]);

  const value = useMemo(
    () => ({
      askQuestion,
      clearPendingQuestion,
      pendingQuestion,
      isOpen,
      setIsOpen: openChange,
      toggleChat,
      currentTool,
      setCurrentTool,
      suggestedQuestions,
      startNewChat,
      locale,
    }),
    [
      askQuestion,
      clearPendingQuestion,
      pendingQuestion,
      isOpen,
      openChange,
      toggleChat,
      currentTool,
      suggestedQuestions,
      startNewChat,
      locale,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
