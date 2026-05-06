"use client";

import { useLocale } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface ToolInfo {
  name: string;
  slug: string;
}

interface ChatContextValue {
  currentTool: ToolInfo | null;
  isOpen: boolean;
  locale: string;
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

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const startNewChat = useCallback(() => {
    // Force re-render to reset chat messages
    forceUpdate({});
  }, []);

  const suggestedQuestions = useMemo(() => {
    return currentTool
      ? getToolQuestionsForLocale(currentTool, locale)
      : getQuestionsForLocale(locale);
  }, [currentTool, locale]);

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      toggleChat,
      currentTool,
      setCurrentTool,
      suggestedQuestions,
      startNewChat,
      locale,
    }),
    [isOpen, toggleChat, currentTool, suggestedQuestions, startNewChat, locale]
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
