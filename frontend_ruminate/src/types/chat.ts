import type { Block } from "../components/pdf/PDFViewer_working";

export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system"
}

export interface GeneratedSummary {
  note_id: string;
  block_id: string;
  summary_content?: string; // The actual summary text (optional for backwards compatibility)
  summary_range: {
    from_message_id: string;
    message_count: number;
    topic?: string;
  };
  created_at: string;
}

export interface MessageMetadata {
  generated_summaries?: GeneratedSummary[];
  [key: string]: any;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parent_id: string | null;
  children: Message[];
  active_child_id: string | null;
  created_at: string;
  meta_data?: MessageMetadata;
}

export interface MessageNode extends Message {
  children: MessageNode[];
  isActive: boolean;
}

export interface ChatPaneProps {
  block: Block;
  documentId: string;
  conversationId: string;
  onClose: () => void;
  onNextBlock?: () => void;
  onPreviousBlock?: () => void;
  hasNextBlock?: boolean;
  hasPreviousBlock?: boolean;
  onSwitchToNotesTab?: () => void;
}