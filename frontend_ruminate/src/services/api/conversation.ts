import { Message } from "../../types/chat";
import { authenticatedFetch, API_BASE_URL } from "../../utils/api";

export const conversationApi = {
  create: async (documentId?: string, type: string = "chat"): Promise<{ conversation_id: string; system_msg_id: string }> => {
    const body = documentId ? { type: type.toUpperCase(), document_id: documentId } : { type: type.toUpperCase() };
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations`,
      { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    if (!response.ok) throw new Error("Failed to create conversation");
    return response.json();
  },

  getDocumentConversations: async (documentId: string): Promise<any[]> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations?document_id=${documentId}`
    );
    if (!response.ok) throw new Error("Failed to fetch document conversations");
    return response.json();
  },

  getMessageTree: async (conversationId: string): Promise<Message[]> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${conversationId}/tree`
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
  ): Promise<{ user_id: string; ai_id: string }> => {
    const response = await authenticatedFetch(
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
    
    const responseData = await response.json();
    console.log("conversationApi.sendMessage response:", responseData);
    return responseData;
  },

  editMessage: async (
    conversationId: string, 
    messageId: string, 
    content: string,
    activeThreadIds: string[]
  ): Promise<[any, string]> => {
    const response = await authenticatedFetch(
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
  ): Promise<{ user_id: string; ai_id: string }> => {
    const response = await authenticatedFetch(
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
