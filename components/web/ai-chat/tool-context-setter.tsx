"use client";

import { useEffect } from "react";
import { useChatContext } from "./chat-context";

interface ToolContextSetterProps {
  name: string;
  slug: string;
}

export function ToolContextSetter({ slug, name }: ToolContextSetterProps) {
  const { setCurrentTool } = useChatContext();

  useEffect(() => {
    setCurrentTool({ slug, name });
    return () => setCurrentTool(null);
  }, [slug, name, setCurrentTool]);

  return null;
}
