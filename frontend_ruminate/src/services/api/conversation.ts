import { Message } from "../../types/chat";
import { authenticatedFetch, API_BASE_URL } from "../../utils/api";

interface ApiOptions {
  debugMode?: boolean;
}

export const conversationApi = {
  create: async (documentId?: string, type: string = "chat", meta?: any): Promise<{ 
    conversation_id: string; 
    system_msg_id: string;
  }> => {
    const body: any = { type: type.toUpperCase() };
    if (documentId) body.document_id = documentId;
    if (meta) body.meta = meta;
    
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

  getMessageTree: async (conversationId: string): Promise<{
    messages: Message[];
  }> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${conversationId}/tree`
    );
    if (!response.ok) throw new Error("Failed to fetch conversation history");
    const data = await response.json();
    
    // Handle both old format (array) and new format (object with messages)
    if (Array.isArray(data)) {
      return { messages: data };
    }
    return { messages: data.messages };
  },

  sendMessage: async (
    conversationId: string, 
    content: string, 
    parentId: string,
    activeThreadIds: string[],
    selectedBlockId?: string,
    options?: ApiOptions
  ): Promise<{ user_id: string; ai_id: string }> => {
    const headers: HeadersInit = { 
      "Content-Type": "application/json",
      "X-Debug-Mode": "true" // HARDCODED DEBUG MODE
    };
    
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers,
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
    selectedBlockId?: string,
    options?: ApiOptions
  ): Promise<{ user_id: string; ai_id: string }> => {
    const headers: HeadersInit = { 
      "Content-Type": "application/json",
      "X-Debug-Mode": "true" // HARDCODED DEBUG MODE
    };
    
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/edit_streaming`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ 
          content,
          active_thread_ids: activeThreadIds,
          selected_block_id: selectedBlockId
        })
      }
    );
    if (!response.ok) throw new Error("Failed to edit message with streaming");
    return response.json();
  },

};
