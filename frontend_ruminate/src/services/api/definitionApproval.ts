import { authenticatedFetch, API_BASE_URL } from '@/utils/api';

export interface PendingDefinition {
  id: string;
  term: string;
  document_id: string;
  block_id: string;
  system_prompt: string;
  user_prompt: string;
  full_context: string;
  metadata: {
    document_title?: string;
    document_summary?: string;
    text_start_offset: number;
    text_end_offset: number;
    surrounding_text?: string;
  };
  created_at: string;
  status: string;
}

export const definitionApprovalApi = {
  /**
   * Get a pending definition prompt by approval ID
   */
  getPendingDefinition: async (approvalId: string): Promise<PendingDefinition> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/definition-approval/${approvalId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch pending definition');
    }
    return response.json();
  },

  /**
   * Approve a pending definition, optionally with modifications
   */
  approve: async (
    approvalId: string, 
    modifiedSystemPrompt?: string,
    modifiedUserPrompt?: string
  ): Promise<{ status: string; approval_id: string }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/definition-approval/${approvalId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approval_id: approvalId,
        modified_system_prompt: modifiedSystemPrompt,
        modified_user_prompt: modifiedUserPrompt
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to approve definition');
    }
    
    return response.json();
  },

  /**
   * Reject a pending definition
   */
  reject: async (approvalId: string, reason?: string): Promise<{ status: string; approval_id: string }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/definition-approval/${approvalId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approval_id: approvalId,
        reason: reason || ''
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to reject definition');
    }
    
    return response.json();
  },

  /**
   * List all pending definition approvals
   */
  listPending: async (): Promise<{ pending_approvals: Array<{
    approval_id: string;
    term: string;
    document_id: string;
    block_id: string;
    created_at: string;
  }> }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/definition-approval/pending/list`);
    if (!response.ok) {
      throw new Error('Failed to fetch pending approvals');
    }
    return response.json();
  },
};