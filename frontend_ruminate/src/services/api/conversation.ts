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
    selectedBlockId?: string
  ): Promise<[any, string]> => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content, 
          parent_version_id: parentId,
          selected_block_id: selectedBlockId 
        })
      }
    );
    if (!response.ok) throw new Error("Failed to send message");
    return response.json();
  },

  streamMessage: (
    conversationId: string,
    content: string,
    parentId: string,
    selectedBlockId: string,
    onToken: (token: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): { abort: () => void } => {
    // Create the URL with query parameters
    const url = new URL(`${API_BASE_URL}/conversations/${conversationId}/messages/stream`);
    
    // Create an AbortController to allow stopping the stream
    const controller = new AbortController();
    
    // Start the fetch request
    (async () => {
      try {
        // First, send the message using fetch with appropriate headers
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content, 
            parent_version_id: parentId,
            selected_block_id: selectedBlockId 
          }),
          signal: controller.signal
        });
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        // Handle the streaming response
        const reader = response.body?.getReader();
        
        if (!reader) {
          throw new Error('ReadableStream not supported');
        }
        
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            onComplete();
            break;
          }
          
          // Decode and send the token to the callback
          const token = decoder.decode(value, { stream: true });
          onToken(token);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    })();
    
    // Return the abort function for the caller to stop the stream
    return {
      abort: () => controller.abort()
    };
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
