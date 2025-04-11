import type { Block } from "../components/pdf/PDFViewer";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parent_id: string | null;
  children: Message[];
  active_child_id: string | null;
  created_at: string;
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
}