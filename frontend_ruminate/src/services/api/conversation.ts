import { Message } from "../../types/chat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const conversationApi = {
  create: async (documentId: string): Promise<{ id: string }> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations?document_id=${documentId}`,
      { method: "POST" }
    );
    if (!response.ok) throw new Error("Failed to create conversation");
    return response.json();
  },

  getDocumentConversations: async (documentId: string): Promise<any[]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/document/${documentId}`
    );
    if (!response.ok) throw new Error("Failed to fetch document conversations");
    return response.json();
  },

  getMessageTree: async (conversationId: string): Promise<Message[]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/tree`
    );
    if (!response.ok) throw new Error("Failed to fetch conversation history");
    return response.json();
  },

  sendMessage: async (
    conversationId: string, 
    content: string, 
    parentId: string,
    activeThreadIds: string[],
    selectedBlockId?: string
  ): Promise<[any, string]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content, 
          parent_id: parentId,
          active_thread_ids: activeThreadIds,
          selected_block_id: selectedBlockId 
        })
      }
    );
    if (!response.ok) throw new Error("Failed to send message");
    return response.json();
  },

  editMessage: async (
    conversationId: string, 
    messageId: string, 
    content: string,
    activeThreadIds: string[]
  ): Promise<[any, string]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content,
          active_thread_ids: activeThreadIds
        })
      }
    );
    if (!response.ok) throw new Error("Failed to edit message");
    return response.json();
  },
  
  editMessageStreaming: async (
    conversationId: string, 
    messageId: string, 
    content: string,
    activeThreadIds: string[],
    selectedBlockId?: string
  ): Promise<[string, string]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/edit_streaming`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content,
          active_thread_ids: activeThreadIds,
          selected_block_id: selectedBlockId
        })
      }
    );
    if (!response.ok) throw new Error("Failed to edit message with streaming");
    return response.json();
  }
};
