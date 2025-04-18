import React, { ReactNode } from "react";

interface ConversationPaneProps {
  /** Optional header above the message area */
  header?: ReactNode;
  /** The scrollable message list */
  body: ReactNode;
  /** The input component */
  input: ReactNode;
}

/**
 * Shared wrapper for chat/agent conversations:
 * sets up flex column, header, scrollable body, and input.
 */
export default function ConversationPane({ header, body, input }: ConversationPaneProps) {
  return (
    <div className="h-full flex flex-col min-h-0 bg-white">
      {header}
      <div className="flex-1 flex flex-col overflow-hidden">
        {body}
      </div>
      {input}
    </div>
  );
}
