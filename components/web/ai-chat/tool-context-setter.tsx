"use client";

import { useEffect } from "react";
import type { RoleQuestions } from "~/config/roles";
import { useChatContext } from "./chat-context";

interface ToolContextSetterProps {
  name: string;
  roleQuestions?: RoleQuestions;
  slug: string;
}

export function ToolContextSetter({
  slug,
  name,
  roleQuestions,
}: ToolContextSetterProps) {
  const { setCurrentTool } = useChatContext();

  useEffect(() => {
    setCurrentTool({ slug, name, roleQuestions });
    return () => setCurrentTool(null);
  }, [slug, name, roleQuestions, setCurrentTool]);

  return null;
}
