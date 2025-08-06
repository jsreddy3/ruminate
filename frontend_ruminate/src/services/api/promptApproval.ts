import { authenticatedFetch, API_BASE_URL } from "../../utils/api";

export interface PromptMessage {
  role: string;
  content: string;
}

export interface PendingPrompt {
  id: string;
  prompt: PromptMessage[];
  conversation_id: string;
  message_id: string;
  metadata: {
    original_message_count: number;
    total_chars: number;
  };
  created_at: string;
  status: string;
}

export const promptApprovalApi = {
  getPendingPrompt: async (approvalId: string): Promise<PendingPrompt> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prompt-approval/${approvalId}`
    );
    if (!response.ok) throw new Error("Failed to fetch pending prompt");
    return response.json();
  },

  approve: async (approvalId: string, modifiedPrompt?: PromptMessage[]): Promise<any> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prompt-approval/${approvalId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approvalId,
          modified_prompt: modifiedPrompt
        })
      }
    );
    if (!response.ok) throw new Error("Failed to approve prompt");
    return response.json();
  },

  reject: async (approvalId: string, reason?: string): Promise<any> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prompt-approval/${approvalId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approvalId,
          reason: reason || "User rejected prompt"
        })
      }
    );
    if (!response.ok) throw new Error("Failed to reject prompt");
    return response.json();
  },

  listPending: async (): Promise<{ pending_approvals: any[] }> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prompt-approval/pending/list`
    );
    if (!response.ok) throw new Error("Failed to list pending approvals");
    return response.json();
  }
};