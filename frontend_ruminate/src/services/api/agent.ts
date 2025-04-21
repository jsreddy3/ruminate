import { Message } from "../../types/chat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export interface AgentStep {
  id: string;
  step_type: string;
  content: string;
  step_number: number;
  created_at: string;
  metadata?: any;
}

export const agentApi = {
  createAgentRabbithole: async (
    documentId: string,
    blockId: string,
    selectedText: string,
    startOffset: number,
    endOffset: number,
    documentConversationId?: string
  ): Promise<{ conversation_id: string }> => {
    const response = await fetch(
      `${API_BASE_URL}/agent-rabbitholes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: documentId,
          block_id: blockId,
          selected_text: selectedText,
          start_offset: startOffset,
          end_offset: endOffset,
          document_conversation_id: documentConversationId
        })
      }
    );
    
    if (!response.ok) throw new Error("Failed to create agent rabbithole");
    return response.json();
  },

  sendAgentMessage: async (
    conversationId: string,
    content: string,
    parentId: string
  ): Promise<{ message_id: string; content: string; role: string }> => {
    const response = await fetch(
      `${API_BASE_URL}/agent-rabbitholes/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content, 
          parent_id: parentId 
        })
      }
    );
    
    if (!response.ok) throw new Error("Failed to send agent message");
    return response.json();
  },

  getMessageSteps: async (
    conversationId: string,
    messageId: string
  ): Promise<AgentStep[]> => {
    const response = await fetch(
      `${API_BASE_URL}/agent-rabbitholes/${conversationId}/messages/${messageId}/steps`
    );
    
    if (!response.ok) throw new Error("Failed to fetch agent message steps");
    return response.json();
  },
  
  // Since both agent and regular chats share the same tree structure
  // they share the message tree endpoint
  getMessageTree: async (conversationId: string): Promise<Message[]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/tree`
    );
    if (!response.ok) throw new Error("Failed to fetch conversation history");
    return response.json();
  }
}; 