"use client";

import { ChatButton } from "./chat-button";
import { ChatDialog } from "./chat-dialog";

export function AIChatWidget() {
  return (
    <>
      <ChatDialog />
      <ChatButton />
    </>
  );
}

export { ChatProvider, useChatContext } from "./chat-context";
export { ToolContextSetter } from "./tool-context-setter";
