import { useState, useCallback } from 'react';

interface PromptApprovalEvent {
  type: 'prompt_approval_required' | 'prompt_approved' | 'prompt_rejected';
  approval_id?: string;
  conversation_id?: string;
  message_id?: string;
  reason?: string;
}

export const usePromptApproval = (debugMode: boolean = false) => {
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(debugMode);

  // Listen for approval events from SSE
  const handleSSEMessage = useCallback((data: string) => {
    try {
      // Check if this is a JSON event
      if (data.startsWith('{')) {
        const event = JSON.parse(data);
        
        // Check if this is a prompt approval event
        if (event.type === 'prompt_approval_required') {
          setPendingApprovalId(event.approval_id);
        } else if (event.type === 'prompt_approved' || event.type === 'prompt_rejected') {
          // Clear the pending approval
          setPendingApprovalId(null);
        }
      }
    } catch (err) {
      // Not a JSON message or not an approval event, ignore
    }
  }, []);

  const toggleDebugMode = useCallback(() => {
    setIsDebugMode(prev => !prev);
  }, []);

  const clearPendingApproval = useCallback(() => {
    setPendingApprovalId(null);
  }, []);

  return {
    pendingApprovalId,
    isDebugMode,
    toggleDebugMode,
    clearPendingApproval,
    handleSSEMessage
  };
};