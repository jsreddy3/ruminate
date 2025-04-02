import { Message } from "../../types/chat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const conversationApi = {
  create: async (documentId: string, blockId: string): Promise<{ id: string }> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations?document_id=${documentId}&block_id=${blockId}`,
      { method: "POST" }
    );
    if (!response.ok) throw new Error("Failed to create conversation");
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
    parentId: string
  ): Promise<[any, string]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parent_id: parentId })
      }
    );
    if (!response.ok) throw new Error("Failed to send message");
    return response.json();
  },

  editMessage: async (
    conversationId: string, 
    messageId: string, 
    content: string
  ): Promise<[any, string]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      }
    );
    if (!response.ok) throw new Error("Failed to edit message");
    return response.json();
  }
};
