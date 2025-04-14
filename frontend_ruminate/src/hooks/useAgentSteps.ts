// src/hooks/useAgentSteps.ts
import { useState, useEffect } from 'react';
import { getAgentSteps, AgentStep } from '../services/rabbithole';

/**
 * Hook to fetch agent process steps for a specific message
 * 
 * @param conversationId The ID of the conversation 
 * @param messageId The ID of the message to fetch steps for
 * @returns Object containing steps, loading state, and error
 */
export function useAgentSteps(conversationId: string | null, messageId: string | null) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    // Don't try to fetch steps if we don't have both IDs
    if (!conversationId || !messageId) return;
    
    async function fetchSteps() {
      setLoading(true);
      try {
        if (conversationId && messageId) {
          console.log(`Fetching agent steps for message ${messageId} in conversation ${conversationId}`);
          const fetchedSteps = await getAgentSteps(conversationId, messageId);
          console.log(`Fetched ${fetchedSteps.length} agent steps`);
          setSteps(fetchedSteps);
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching agent steps:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSteps();
  }, [conversationId, messageId]);
  
  return { steps, loading, error };
}
