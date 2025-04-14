// src/components/interactive/rabbithole/components/AgentConversation/AgentMessage.tsx
import { useState, useEffect, useMemo } from "react";
import { Message } from "../../../../../types/chat";
import { AgentEvent, AgentStep } from "../../../../../services/rabbithole";
import { useAgentSteps } from "../../../../../hooks/useAgentSteps";
import ExplorationPanel from "./ExplorationEvents/ExplorationPanel";

interface AgentMessageProps {
  message: Message;
  conversationId: string;
  events: AgentEvent[];
  isLoading: boolean;
}

export default function AgentMessage({ message, conversationId, events, isLoading }: AgentMessageProps) {
  const [showExploration, setShowExploration] = useState(false);
  
  // Get stored process steps for this message
  const { steps: storedSteps, loading: stepsLoading } = useAgentSteps(conversationId, message.id);
  
  // Use either real-time events (if loading) or stored steps (if complete)
  const explorationData = useMemo(() => {
    // If we're still loading or if stored steps aren't ready yet but we have events, use real-time events
    if (isLoading || (storedSteps.length === 0 && events.length > 0)) {
      return events;
    }
    
    // Otherwise, use stored steps from the database
    return storedSteps.map(step => ({
      type: step.step_type as any, // Convert to AgentEventType
      action: step.metadata?.action,
      input: step.metadata?.input,
      result_preview: step.metadata?.result,
      message: step.content,
      timestamp: new Date(step.created_at).getTime()
    }));
  }, [events, storedSteps, isLoading]);
  
  // Log for debugging
  console.log(`AgentMessage ${message.id}: ${events.length} real-time events, ${storedSteps.length} stored steps, isLoading=${isLoading}`);
  
  // Automatically show exploration if there are events
  useEffect(() => {
    if (explorationData.length > 0 && !showExploration) {
      setShowExploration(true);
    }
  }, [explorationData.length]);
  
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="bg-indigo-50 text-neutral-800 p-3 rounded-lg shadow-sm border border-indigo-100">
          {isLoading ? (
            <em>AI is exploring...</em>
          ) : (
            <div className="prose prose-sm max-w-none">
              {message.content}
            </div>
          )}
        </div>
        
        {explorationData.length > 0 && (
          <button
            onClick={() => setShowExploration(!showExploration)}
            className="text-xs text-indigo-600 mt-1 flex items-center"
          >
            <span className="mr-1">{showExploration ? '▼' : '►'}</span>
            {showExploration ? 'Hide exploration' : 'Show exploration'} ({explorationData.length} steps)
          </button>
        )}
        
        {showExploration && explorationData.length > 0 && (
          <div className="mt-2">
            <ExplorationPanel events={explorationData} isExpanded={true} />
          </div>
        )}
      </div>
    </div>
  );
}